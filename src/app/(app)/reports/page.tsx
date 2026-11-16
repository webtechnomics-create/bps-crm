import Link from "next/link";
import type { LeadSource, LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { SOURCE_LABEL, STATUS_LABEL, STATUS_ORDER } from "@/lib/constants";
import { PageHeader, Stat, Empty } from "@/components/ui";
import { inr, pct } from "@/lib/utils";
import { SpendForm, SpendRow, MetaSyncButton } from "./spend-form";

const FUNNEL: LeadStatus[] = ["NEW", "CONTACTED", "INTERESTED", "VISIT_SCHEDULED", "VISIT_DONE", "FORM_FILLED", "INTERACTION_DONE", "ADMISSION_CONFIRMED"];
const idx = (s: LeadStatus) => FUNNEL.indexOf(s);
const metaGroup = (s: LeadSource): LeadSource => (s === "INSTAGRAM" ? "FACEBOOK" : s);

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const u = await requirePermission("reports:view");
  const sp = await searchParams;
  const now = new Date();
  const defFrom = new Date(now.getTime() - 89 * 86400_000).toISOString().slice(0, 10);
  const from = sp.from || defFrom;
  const to = sp.to || now.toISOString().slice(0, 10);
  const range = { gte: new Date(from + "T00:00:00+05:30"), lte: new Date(to + "T23:59:59+05:30") };

  const leads = await prisma.lead.findMany({
    where: { deletedAt: null, createdAt: range },
    select: {
      id: true,
      source: true,
      status: true,
      campaignName: true,
      classApplying: true,
      lostReason: true,
      assignedToId: true,
      createdAt: true,
      firstContactedAt: true,
      callAttempts: true,
      activities: { where: { type: "STATUS_CHANGE" }, select: { toStatus: true } },
    },
  });
  const months: string[] = [];
  for (let d = new Date(from.slice(0, 7) + "-01"); d <= new Date(to); d.setMonth(d.getMonth() + 1)) months.push(d.toISOString().slice(0, 7));
  const [spends, users] = await Promise.all([
    prisma.campaignSpend.findMany({ where: { month: { in: months } }, orderBy: [{ month: "desc" }, { platform: "asc" }] }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);

  // Highest stage each lead ever reached (lost leads keep the stage they got to before being lost).
  const reached = (l: (typeof leads)[number]) =>
    Math.max(l.status === "LOST" ? 0 : idx(l.status), ...l.activities.map((a) => (a.toStatus && a.toStatus !== "LOST" ? idx(a.toStatus) : 0)), l.callAttempts > 0 ? 1 : 0);

  const total = leads.length;
  const adm = leads.filter((l) => l.status === "ADMISSION_CONFIRMED").length;
  const lost = leads.filter((l) => l.status === "LOST").length;
  const totalSpend = spends.reduce((a, s) => a + s.amount, 0);
  const responseMins = leads
    .filter((l) => l.firstContactedAt)
    .map((l) => (l.firstContactedAt!.getTime() - l.createdAt.getTime()) / 60000)
    .sort((a, b) => a - b);
  const median = responseMins.length ? responseMins[Math.floor(responseMins.length / 2)] : null;
  const fmtMins = (m: number | null) => (m == null ? "-" : m < 60 ? `${Math.round(m)} min` : m < 1440 ? `${(m / 60).toFixed(1)} hrs` : `${(m / 1440).toFixed(1)} days`);

  const funnel = FUNNEL.map((s, i) => ({ s, n: leads.filter((l) => reached(l) >= i).length }));

  // Source table
  const spendBySource = new Map<LeadSource, number>();
  for (const s of spends) spendBySource.set(metaGroup(s.platform), (spendBySource.get(metaGroup(s.platform)) ?? 0) + s.amount);
  const sourceRows = Object.entries(
    leads.reduce<Record<string, typeof leads>>((acc, l) => {
      (acc[metaGroup(l.source)] ||= []).push(l);
      return acc;
    }, {}),
  )
    .map(([src, ls]) => {
      const a = ls.filter((l) => l.status === "ADMISSION_CONFIRMED").length;
      const spend = spendBySource.get(src as LeadSource) ?? 0;
      return {
        src: src as LeadSource,
        leads: ls.length,
        contacted: ls.filter((l) => reached(l) >= 1).length,
        visits: ls.filter((l) => reached(l) >= idx("VISIT_DONE")).length,
        adm: a,
        spend,
      };
    })
    .sort((a, b) => b.leads - a.leads);

  // Campaign table
  const campMap = new Map<string, { src: LeadSource; leads: number; visits: number; adm: number }>();
  for (const l of leads) {
    if (!l.campaignName) continue;
    const k = `${metaGroup(l.source)}|${l.campaignName}`;
    const r = campMap.get(k) ?? { src: metaGroup(l.source), leads: 0, visits: 0, adm: 0 };
    r.leads++;
    if (reached(l) >= idx("VISIT_DONE")) r.visits++;
    if (l.status === "ADMISSION_CONFIRMED") r.adm++;
    campMap.set(k, r);
  }
  const campSpend = new Map<string, number>();
  for (const s of spends) if (s.campaignName) campSpend.set(`${metaGroup(s.platform)}|${s.campaignName}`, (campSpend.get(`${metaGroup(s.platform)}|${s.campaignName}`) ?? 0) + s.amount);
  const campaigns = [...campMap.entries()].map(([k, v]) => ({ name: k.split("|").slice(1).join("|"), ...v, spend: campSpend.get(k) ?? 0 })).sort((a, b) => b.adm - a.adm || b.leads - a.leads);

  const count = <T extends string>(arr: (T | null)[]) =>
    Object.entries(arr.reduce<Record<string, number>>((a, k) => ((a[k ?? "Not set"] = (a[k ?? "Not set"] ?? 0) + 1), a), {})).sort((a, b) => b[1] - a[1]);
  const lostReasons = count(leads.filter((l) => l.status === "LOST").map((l) => l.lostReason));
  const classDemand = count(leads.map((l) => l.classApplying));
  const classAdm = Object.fromEntries(count(leads.filter((l) => l.status === "ADMISSION_CONFIRMED").map((l) => l.classApplying)));

  const userName = Object.fromEntries(users.map((x) => [x.id, x.name]));
  const team = Object.entries(
    leads.reduce<Record<string, typeof leads>>((acc, l) => {
      (acc[l.assignedToId ?? "none"] ||= []).push(l);
      return acc;
    }, {}),
  ).map(([id, ls]) => {
    const rt = ls.filter((l) => l.firstContactedAt).map((l) => (l.firstContactedAt!.getTime() - l.createdAt.getTime()) / 60000).sort((a, b) => a - b);
    return {
      name: id === "none" ? "Unassigned" : userName[id] ?? "?",
      leads: ls.length,
      untouched: ls.filter((l) => l.callAttempts === 0 && l.status === "NEW").length,
      visits: ls.filter((l) => reached(l) >= idx("VISIT_DONE")).length,
      adm: ls.filter((l) => l.status === "ADMISSION_CONFIRMED").length,
      rt: rt.length ? rt[Math.floor(rt.length / 2)] : null,
    };
  });

  const Bar = ({ v, max, color = "bg-brand-500" }: { v: number; max: number; color?: string }) => (
    <div className="h-2 w-full rounded-full bg-slate-100">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${max ? (v / max) * 100 : 0}%` }} />
    </div>
  );

  return (
    <div>
      <PageHeader title="Reports" subtitle={`Leads received between ${from} and ${to}`}>
        <form className="flex items-center gap-2">
          <input type="date" name="from" defaultValue={from} className="input w-auto" />
          <input type="date" name="to" defaultValue={to} className="input w-auto" />
          <button className="btn-primary">Apply</button>
        </form>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Leads" value={total} />
        <Stat label="Admissions" value={adm} tone="good" hint={pct(adm, total) + " conversion"} />
        <Stat label="Lost" value={lost} tone="bad" hint={pct(lost, total)} />
        <Stat label="Median first-call time" value={fmtMins(median)} tone={median != null && median > 60 ? "warn" : "default"} hint="target: under 15 min" />
        <Stat label="Ad spend (months in range)" value={inr(totalSpend)} />
        <Stat label="Cost per admission" value={adm && totalSpend ? inr(totalSpend / adm) : "-"} hint={total && totalSpend ? `${inr(totalSpend / total)} per lead` : undefined} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-3 font-semibold">Admission funnel</h2>
          <p className="mb-3 text-xs text-slate-500">How many leads reached each stage (at any time).</p>
          <div className="space-y-2.5">
            {funnel.map((f, i) => (
              <div key={f.s}>
                <div className="mb-0.5 flex justify-between text-xs">
                  <span>{STATUS_LABEL[f.s]}</span>
                  <span className="tabular-nums">
                    <b>{f.n}</b> <span className="text-slate-400">{i > 0 ? `(${pct(f.n, funnel[i - 1].n)} of previous)` : ""}</span>
                  </span>
                </div>
                <Bar v={f.n} max={funnel[0].n} color={f.s === "ADMISSION_CONFIRMED" ? "bg-emerald-500" : "bg-brand-500"} />
              </div>
            ))}
          </div>
        </div>
        <div className="card p-4">
          <h2 className="mb-3 font-semibold">Why leads were lost</h2>
          {lostReasons.length === 0 ? (
            <Empty>No lost leads in this period.</Empty>
          ) : (
            <div className="space-y-2.5">
              {lostReasons.map(([r, n]) => (
                <div key={r}>
                  <div className="mb-0.5 flex justify-between text-xs">
                    <span>{r}</span>
                    <b className="tabular-nums">{n}</b>
                  </div>
                  <Bar v={n} max={lostReasons[0][1]} color="bg-rose-400" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card mt-5 overflow-x-auto">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold">Source performance</h2>
          <p className="text-xs text-slate-500">Facebook and Instagram are combined as “Meta” because Meta reports their spend together.</p>
        </div>
        <table className="min-w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">Source</th>
              <th className="th text-right">Leads</th>
              <th className="th text-right">Contacted</th>
              <th className="th text-right">Visited</th>
              <th className="th text-right">Admissions</th>
              <th className="th text-right">Conv.</th>
              <th className="th text-right">Spend</th>
              <th className="th text-right">Cost / lead</th>
              <th className="th text-right">Cost / admission</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sourceRows.map((r) => (
              <tr key={r.src}>
                <td className="td font-medium">{r.src === "FACEBOOK" ? "Meta (FB + Insta)" : SOURCE_LABEL[r.src]}</td>
                <td className="td text-right tabular-nums">{r.leads}</td>
                <td className="td text-right tabular-nums">{r.contacted}</td>
                <td className="td text-right tabular-nums">{r.visits}</td>
                <td className="td text-right font-medium tabular-nums text-emerald-600">{r.adm}</td>
                <td className="td text-right tabular-nums">{pct(r.adm, r.leads)}</td>
                <td className="td text-right tabular-nums">{r.spend ? inr(r.spend) : "-"}</td>
                <td className="td text-right tabular-nums">{r.spend ? inr(r.spend / r.leads) : "-"}</td>
                <td className="td text-right tabular-nums">{r.spend && r.adm ? inr(r.spend / r.adm) : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {sourceRows.length === 0 && <Empty>No leads in this period.</Empty>}
      </div>

      <div className="card mt-5 overflow-x-auto">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold">Campaign performance</h2>
          <p className="text-xs text-slate-500">Which ads bring real admissions, not just form fills.</p>
        </div>
        <table className="min-w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">Campaign</th>
              <th className="th">Platform</th>
              <th className="th text-right">Leads</th>
              <th className="th text-right">Visited</th>
              <th className="th text-right">Admissions</th>
              <th className="th text-right">Conv.</th>
              <th className="th text-right">Spend</th>
              <th className="th text-right">Cost / admission</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {campaigns.map((c) => (
              <tr key={c.src + c.name}>
                <td className="td max-w-xs truncate font-medium" title={c.name}>
                  <Link href={`/leads?q=${encodeURIComponent(c.name)}`} className="hover:text-brand-700">
                    {c.name}
                  </Link>
                </td>
                <td className="td">{c.src === "FACEBOOK" ? "Meta" : SOURCE_LABEL[c.src]}</td>
                <td className="td text-right tabular-nums">{c.leads}</td>
                <td className="td text-right tabular-nums">{c.visits}</td>
                <td className="td text-right font-medium tabular-nums text-emerald-600">{c.adm}</td>
                <td className="td text-right tabular-nums">{pct(c.adm, c.leads)}</td>
                <td className="td text-right tabular-nums">{c.spend ? inr(c.spend) : "-"}</td>
                <td className="td text-right tabular-nums">{c.spend && c.adm ? inr(c.spend / c.adm) : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {campaigns.length === 0 && <Empty>No campaign-tagged leads in this period.</Empty>}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="card overflow-x-auto">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="font-semibold">Counselor performance</h2>
          </div>
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">Name</th>
                <th className="th text-right">Leads</th>
                <th className="th text-right">Never called</th>
                <th className="th text-right">Visits</th>
                <th className="th text-right">Admissions</th>
                <th className="th text-right">1st call (median)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {team.map((t) => (
                <tr key={t.name}>
                  <td className="td font-medium">{t.name}</td>
                  <td className="td text-right tabular-nums">{t.leads}</td>
                  <td className={`td text-right tabular-nums ${t.untouched ? "text-amber-600" : ""}`}>{t.untouched}</td>
                  <td className="td text-right tabular-nums">{t.visits}</td>
                  <td className="td text-right font-medium tabular-nums text-emerald-600">{t.adm}</td>
                  <td className="td text-right tabular-nums">{fmtMins(t.rt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card p-4">
          <h2 className="mb-3 font-semibold">Class-wise demand</h2>
          <div className="space-y-2">
            {classDemand.slice(0, 18).map(([c, n]) => (
              <div key={c} className="grid grid-cols-[110px_1fr_70px] items-center gap-2 text-xs">
                <span className="truncate">{c}</span>
                <Bar v={n} max={classDemand[0]?.[1] ?? 1} />
                <span className="text-right tabular-nums">
                  {n} <span className="text-emerald-600">({classAdm[c] ?? 0}✓)</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {can(u.role, "spend:manage") && (
        <div className="card mt-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="font-semibold">Ad spend</h2>
              <p className="text-xs text-slate-500">Enter monthly spend per platform (and optionally per campaign) to see cost per admission.</p>
            </div>
            <MetaSyncButton />
          </div>
          <div className="p-4">
            <SpendForm />
          </div>
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">Month</th>
                <th className="th">Platform</th>
                <th className="th">Campaign</th>
                <th className="th text-right">Amount</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {spends.map((s) => (
                <SpendRow key={s.id} s={{ id: s.id, month: s.month, platform: s.platform === "FACEBOOK" ? "Meta" : SOURCE_LABEL[s.platform], campaignName: s.campaignName, amount: inr(s.amount) }} />
              ))}
            </tbody>
          </table>
          {spends.length === 0 && <Empty>No spend entered for these months.</Empty>}
        </div>
      )}
      <p className="mt-4 text-xs text-slate-400">Statuses used: {STATUS_ORDER.map((s) => STATUS_LABEL[s]).join(" → ")}</p>
    </div>
  );
}
