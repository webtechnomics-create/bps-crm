import Link from "next/link";
import { prisma } from "@/lib/db";
import { leadScope, requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { SOURCE_LABEL, STATUS_LABEL, STATUS_ORDER } from "@/lib/constants";
import { PageHeader, Stat, StatusBadge, SourceBadge, Empty } from "@/components/ui";
import { fmtDateTime, pct, startOfTodayIST, timeAgo } from "@/lib/utils";

export default async function Dashboard() {
  const u = await requireUser();
  const scope = { deletedAt: null, ...leadScope(u) };
  const today = startOfTodayIST();
  const tomorrow = new Date(today.getTime() + 86400_000);
  const monthStart = new Date(today);
  monthStart.setUTCDate(1);
  const thirtyDays = new Date(Date.now() - 30 * 86400_000);

  const [total, newToday, monthLeads, uncontacted, overdue, admissions, admissionsMonth, byStatus, bySource, admBySource, dueToday, recent] = await Promise.all([
    prisma.lead.count({ where: scope }),
    prisma.lead.count({ where: { ...scope, createdAt: { gte: today } } }),
    prisma.lead.count({ where: { ...scope, createdAt: { gte: monthStart } } }),
    prisma.lead.count({ where: { ...scope, status: "NEW", callAttempts: 0 } }),
    prisma.lead.count({ where: { ...scope, nextFollowUpAt: { lt: new Date() }, status: { notIn: ["ADMISSION_CONFIRMED", "LOST"] } } }),
    prisma.lead.count({ where: { ...scope, status: "ADMISSION_CONFIRMED" } }),
    prisma.lead.count({ where: { ...scope, status: "ADMISSION_CONFIRMED", convertedAt: { gte: monthStart } } }),
    prisma.lead.groupBy({ by: ["status"], where: scope, _count: true }),
    prisma.lead.groupBy({ by: ["source"], where: { ...scope, createdAt: { gte: thirtyDays } }, _count: true }),
    prisma.lead.groupBy({ by: ["source"], where: { ...scope, createdAt: { gte: thirtyDays }, status: "ADMISSION_CONFIRMED" }, _count: true }),
    prisma.followUp.findMany({
      where: { done: false, dueAt: { lt: tomorrow }, lead: scope, ...(can(u.role, "lead:view_all") ? {} : { userId: u.id }) },
      orderBy: { dueAt: "asc" },
      take: 10,
      include: { lead: { select: { id: true, parentName: true, phone: true, status: true, classApplying: true } } },
    }),
    prisma.lead.findMany({ where: scope, orderBy: { createdAt: "desc" }, take: 8, include: { assignedTo: { select: { name: true } } } }),
  ]);

  const statusCount = Object.fromEntries(byStatus.map((s) => [s.status, s._count]));
  const maxStatus = Math.max(1, ...byStatus.map((s) => s._count));
  const admMap = Object.fromEntries(admBySource.map((s) => [s.source, s._count]));

  let team: { id: string; name: string; leads: number; calls: number; admissions: number; overdue: number }[] = [];
  if (can(u.role, "lead:view_all")) {
    const counselors = await prisma.user.findMany({ where: { active: true, role: { in: ["COUNSELOR", "ADMIN"] } }, select: { id: true, name: true } });
    const [leadCounts, callCounts, admCounts, overdueCounts] = await Promise.all([
      prisma.lead.groupBy({ by: ["assignedToId"], where: { deletedAt: null, status: { notIn: ["ADMISSION_CONFIRMED", "LOST"] } }, _count: true }),
      prisma.activity.groupBy({ by: ["userId"], where: { type: "CALL", createdAt: { gte: today } }, _count: true }),
      prisma.lead.groupBy({ by: ["assignedToId"], where: { deletedAt: null, status: "ADMISSION_CONFIRMED", convertedAt: { gte: monthStart } }, _count: true }),
      prisma.lead.groupBy({ by: ["assignedToId"], where: { deletedAt: null, nextFollowUpAt: { lt: new Date() }, status: { notIn: ["ADMISSION_CONFIRMED", "LOST"] } }, _count: true }),
    ]);
    const m = (arr: { _count: number }[], key: "assignedToId" | "userId", id: string) =>
      (arr as ({ _count: number } & Record<string, unknown>)[]).find((x) => x[key] === id)?._count ?? 0;
    team = counselors
      .map((c) => ({
        id: c.id,
        name: c.name,
        leads: m(leadCounts, "assignedToId", c.id),
        calls: m(callCounts, "userId", c.id),
        admissions: m(admCounts, "assignedToId", c.id),
        overdue: m(overdueCounts, "assignedToId", c.id),
      }))
      .sort((a, b) => b.admissions - a.admissions || b.calls - a.calls);
  }

  return (
    <div>
      <PageHeader title={`Namaste, ${u.name.split(" ")[0]} 👋`} subtitle={can(u.role, "lead:view_all") ? "School-wide admission overview" : "Your leads and tasks for today"}>
        {can(u.role, "lead:create") && (
          <Link href="/leads/new" className="btn-primary">
            + Add Lead
          </Link>
        )}
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="New leads today" value={newToday} hint={`${monthLeads} this month`} />
        <Link href="/leads?due=uncontacted">
          <Stat label="Never called" value={uncontacted} tone={uncontacted ? "warn" : "default"} hint="call these first" />
        </Link>
        <Link href="/leads?due=overdue">
          <Stat label="Overdue follow-ups" value={overdue} tone={overdue ? "bad" : "default"} />
        </Link>
        <Stat label="Admissions this month" value={admissionsMonth} tone="good" />
        <Stat label="Total admissions" value={admissions} tone="good" hint={`of ${total} leads`} />
        <Stat label="Conversion rate" value={pct(admissions, total)} hint="lead → admission" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="font-semibold">Follow-ups due (today & overdue)</h2>
            <Link href="/follow-ups" className="text-sm text-brand-700">
              View all →
            </Link>
          </div>
          {dueToday.length === 0 ? (
            <Empty>No follow-ups due. 🎉</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {dueToday.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/leads/${f.lead.id}`} className="font-medium text-brand-700 hover:underline">
                      {f.lead.parentName}
                    </Link>
                    <div className="truncate text-xs text-slate-500">
                      {f.lead.classApplying ?? ""} {f.note ? `· ${f.note}` : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`text-xs ${f.dueAt < new Date() ? "font-medium text-rose-600" : "text-slate-500"}`}>{fmtDateTime(f.dueAt)}</span>
                    <a href={`tel:+91${f.lead.phone}`} className="btn-secondary px-2 py-1 text-xs">
                      📞 Call
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-4">
          <h2 className="mb-3 font-semibold">Pipeline</h2>
          <div className="space-y-2">
            {STATUS_ORDER.map((s) => (
              <Link key={s} href={`/leads?status=${s}`} className="block">
                <div className="mb-0.5 flex justify-between text-xs">
                  <span className="text-slate-600">{STATUS_LABEL[s]}</span>
                  <span className="font-medium tabular-nums">{statusCount[s] ?? 0}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div
                    className={`h-2 rounded-full ${s === "ADMISSION_CONFIRMED" ? "bg-emerald-500" : s === "LOST" ? "bg-rose-400" : "bg-brand-500"}`}
                    style={{ width: `${((statusCount[s] ?? 0) / maxStatus) * 100}%` }}
                  />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="card">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="font-semibold">Leads by source</h2>
            <p className="text-xs text-slate-500">Last 30 days</p>
          </div>
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">Source</th>
                <th className="th text-right">Leads</th>
                <th className="th text-right">Admissions</th>
                <th className="th text-right">Conv.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bySource
                .sort((a, b) => b._count - a._count)
                .map((s) => (
                  <tr key={s.source}>
                    <td className="td">{SOURCE_LABEL[s.source]}</td>
                    <td className="td text-right tabular-nums">{s._count}</td>
                    <td className="td text-right tabular-nums">{admMap[s.source] ?? 0}</td>
                    <td className="td text-right tabular-nums">{pct(admMap[s.source] ?? 0, s._count)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {bySource.length === 0 && <Empty>No leads in the last 30 days.</Empty>}
        </div>

        {team.length > 0 ? (
          <div className="card">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="font-semibold">Team performance</h2>
              <p className="text-xs text-slate-500">Calls today · admissions this month</p>
            </div>
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Counselor</th>
                  <th className="th text-right">Open leads</th>
                  <th className="th text-right">Calls today</th>
                  <th className="th text-right">Overdue</th>
                  <th className="th text-right">Admissions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {team.map((t) => (
                  <tr key={t.id}>
                    <td className="td">
                      <Link href={`/leads?assigned=${t.id}`} className="text-brand-700 hover:underline">
                        {t.name}
                      </Link>
                    </td>
                    <td className="td text-right tabular-nums">{t.leads}</td>
                    <td className="td text-right tabular-nums">{t.calls}</td>
                    <td className={`td text-right tabular-nums ${t.overdue ? "text-rose-600" : ""}`}>{t.overdue}</td>
                    <td className="td text-right font-medium tabular-nums text-emerald-600">{t.admissions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="font-semibold">Latest leads</h2>
            </div>
            <RecentList recent={recent} />
          </div>
        )}
      </div>

      {team.length > 0 && (
        <div className="card mt-5">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="font-semibold">Latest leads</h2>
          </div>
          <RecentList recent={recent} />
        </div>
      )}
    </div>
  );
}

function RecentList({
  recent,
}: {
  recent: { id: string; parentName: string; classApplying: string | null; source: import("@prisma/client").LeadSource; status: import("@prisma/client").LeadStatus; createdAt: Date; assignedTo: { name: string } | null }[];
}) {
  if (!recent.length) return <Empty>No leads yet.</Empty>;
  return (
    <ul className="divide-y divide-slate-100">
      {recent.map((l) => (
        <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="min-w-0">
            <Link href={`/leads/${l.id}`} className="font-medium text-brand-700 hover:underline">
              {l.parentName}
            </Link>
            <div className="text-xs text-slate-500">
              {l.classApplying ?? "—"} · {l.assignedTo?.name ?? "Unassigned"} · {timeAgo(l.createdAt)}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <SourceBadge source={l.source} />
            <StatusBadge status={l.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}
