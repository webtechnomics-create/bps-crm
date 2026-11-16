import Link from "next/link";
import type { LeadSource, LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { leadScope, requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { SOURCE_LABEL, STATUS_LABEL, STATUS_ORDER } from "@/lib/constants";
import { CardHeader, Empty, SourceBadge, Stat, StatusBadge } from "@/components/ui";
import { Avatar, Icon } from "@/components/shell";
import { HBars, TrendChart } from "@/components/charts";
import { fmtDateTime, pct, startOfTodayIST, timeAgo } from "@/lib/utils";

const DAY = 86400_000;
const istDay = (d: Date) => new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
const change = (cur: number, prev: number) => (prev ? ((cur - prev) / prev) * 100 : cur ? 100 : null);

export default async function Dashboard() {
  const u = await requireUser();
  const all = can(u.role, "lead:view_all");
  const scope = { deletedAt: null, ...leadScope(u) };
  const today = startOfTodayIST();
  const tomorrow = new Date(today.getTime() + DAY);
  const d30 = new Date(today.getTime() - 29 * DAY);
  const d7 = new Date(today.getTime() - 6 * DAY);
  const d14 = new Date(today.getTime() - 13 * DAY);
  const monthStart = new Date(today);
  monthStart.setUTCDate(1);
  const prevMonthStart = new Date(monthStart);
  prevMonthStart.setUTCMonth(prevMonthStart.getUTCMonth() - 1);
  const prevMonthSameDay = new Date(prevMonthStart.getTime() + (Date.now() - monthStart.getTime()));

  const [recent30, admitted30, week, prevWeek, newToday, uncontacted, overdue, admMonth, admPrevMonth, total, admissions, byStatus, dueList, latest] = await Promise.all([
    prisma.lead.findMany({ where: { ...scope, createdAt: { gte: d30 } }, select: { createdAt: true, source: true, status: true } }),
    prisma.lead.findMany({ where: { ...scope, convertedAt: { gte: d30 } }, select: { convertedAt: true } }),
    prisma.lead.count({ where: { ...scope, createdAt: { gte: d7 } } }),
    prisma.lead.count({ where: { ...scope, createdAt: { gte: d14, lt: d7 } } }),
    prisma.lead.count({ where: { ...scope, createdAt: { gte: today } } }),
    prisma.lead.count({ where: { ...scope, status: "NEW", callAttempts: 0 } }),
    prisma.lead.count({ where: { ...scope, nextFollowUpAt: { lt: new Date() }, status: { notIn: ["ADMISSION_CONFIRMED", "LOST"] } } }),
    prisma.lead.count({ where: { ...scope, status: "ADMISSION_CONFIRMED", convertedAt: { gte: monthStart } } }),
    prisma.lead.count({ where: { ...scope, status: "ADMISSION_CONFIRMED", convertedAt: { gte: prevMonthStart, lt: prevMonthSameDay } } }),
    prisma.lead.count({ where: scope }),
    prisma.lead.count({ where: { ...scope, status: "ADMISSION_CONFIRMED" } }),
    prisma.lead.groupBy({ by: ["status"], where: scope, _count: true }),
    prisma.followUp.findMany({
      where: { done: false, dueAt: { lt: tomorrow }, lead: scope, ...(all ? {} : { userId: u.id }) },
      orderBy: { dueAt: "asc" },
      take: 6,
      include: { lead: { select: { id: true, parentName: true, phone: true, status: true, classApplying: true } } },
    }),
    prisma.lead.findMany({ where: scope, orderBy: { createdAt: "desc" }, take: 6, include: { assignedTo: { select: { name: true } } } }),
  ]);

  // Daily series (IST days)
  const days: { date: string; leads: number; admissions: number }[] = [];
  for (let i = 0; i < 30; i++) days.push({ date: istDay(new Date(d30.getTime() + i * DAY + 6 * 3600_000)), leads: 0, admissions: 0 });
  const idx = Object.fromEntries(days.map((d, i) => [d.date, i]));
  for (const l of recent30) {
    const i = idx[istDay(l.createdAt)];
    if (i != null) days[i].leads++;
  }
  for (const l of admitted30) {
    const i = idx[istDay(l.convertedAt!)];
    if (i != null) days[i].admissions++;
  }

  // Sources (30d)
  const src = new Map<LeadSource, { n: number; adm: number }>();
  for (const l of recent30) {
    const r = src.get(l.source) ?? { n: 0, adm: 0 };
    r.n++;
    if (l.status === "ADMISSION_CONFIRMED") r.adm++;
    src.set(l.source, r);
  }
  const sourceRows = [...src.entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .map(([s, r]) => ({ label: SOURCE_LABEL[s], value: r.n, sub: `${r.adm} adm · ${pct(r.adm, r.n)}`, href: `/leads?source=${s}` }));

  const statusCount = Object.fromEntries(byStatus.map((s) => [s.status, s._count])) as Partial<Record<LeadStatus, number>>;
  const open = STATUS_ORDER.filter((s) => s !== "ADMISSION_CONFIRMED" && s !== "LOST").reduce((a, s) => a + (statusCount[s] ?? 0), 0);

  // Team
  let team: { id: string; name: string; open: number; calls: number; adm: number; overdue: number }[] = [];
  if (all) {
    const people = await prisma.user.findMany({ where: { active: true, role: { in: ["COUNSELOR", "ADMIN"] } }, select: { id: true, name: true } });
    const [o, c, a, od] = await Promise.all([
      prisma.lead.groupBy({ by: ["assignedToId"], where: { deletedAt: null, status: { notIn: ["ADMISSION_CONFIRMED", "LOST"] } }, _count: true }),
      prisma.activity.groupBy({ by: ["userId"], where: { type: "CALL", createdAt: { gte: today } }, _count: true }),
      prisma.lead.groupBy({ by: ["assignedToId"], where: { deletedAt: null, status: "ADMISSION_CONFIRMED", convertedAt: { gte: monthStart } }, _count: true }),
      prisma.lead.groupBy({ by: ["assignedToId"], where: { deletedAt: null, nextFollowUpAt: { lt: new Date() }, status: { notIn: ["ADMISSION_CONFIRMED", "LOST"] } }, _count: true }),
    ]);
    const get = (arr: { _count: number }[], k: string, id: string) => (arr as ({ _count: number } & Record<string, unknown>)[]).find((x) => x[k] === id)?._count ?? 0;
    team = people
      .map((p) => ({ id: p.id, name: p.name, open: get(o, "assignedToId", p.id), calls: get(c, "userId", p.id), adm: get(a, "assignedToId", p.id), overdue: get(od, "assignedToId", p.id) }))
      .filter((t) => t.open || t.calls || t.adm)
      .sort((x, y) => y.adm - x.adm || y.calls - x.calls);
  }
  const maxAdm = Math.max(1, ...team.map((t) => t.adm));

  const hour = Number(new Date().toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }));
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateStr = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" });

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-600 to-indigo-500 p-6 text-white shadow-sm">
        <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10" />
        <div className="absolute -bottom-20 right-32 h-44 w-44 rounded-full bg-white/5" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-sm text-brand-100">{dateStr}</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              {greet}, {u.name.split(" ")[0]}
            </h1>
            <p className="mt-1 text-sm text-brand-100">
              {all ? "Here's how admissions are going across the school." : "Here are your leads and calls for today."}{" "}
              {uncontacted > 0 && (
                <>
                  <b className="text-white">{uncontacted}</b> new {uncontacted === 1 ? "lead is" : "leads are"} waiting for a first call.
                </>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/leads?due=uncontacted" className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-brand-700 shadow-sm hover:bg-brand-50">
              <Icon name="phone" className="h-4 w-4" /> Start calling
            </Link>
            <Link href="/follow-ups" className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/25 hover:bg-white/25">
              Follow-ups
            </Link>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <Stat label="Leads this week" value={week} icon="inbox" delta={change(week, prevWeek)} hint={`${newToday} today`} />
        <Link href="/leads?due=uncontacted">
          <Stat label="Never called" value={uncontacted} icon="phone" tone="warn" hint="call within 15 min" />
        </Link>
        <Link href="/leads?due=overdue">
          <Stat label="Overdue follow-ups" value={overdue} icon="alert" tone="bad" hint="needs attention" />
        </Link>
        <Stat label="Admissions this month" value={admMonth} icon="trophy" tone="good" delta={change(admMonth, admPrevMonth)} hint="vs last month" />
        <Stat label="Open pipeline" value={open} icon="board" tone="violet" hint={`${total} total leads`} />
        <Stat label="Conversion rate" value={pct(admissions, total)} icon="percent" tone="good" hint={`${admissions} admissions`} />
      </div>

      {/* Trend + Pipeline */}
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="card min-w-0 xl:col-span-2">
          <CardHeader title="Leads received" subtitle="Per day, last 30 days · hover for admissions">
            <div className="text-right">
              <div className="text-2xl font-semibold tabular-nums">{recent30.length}</div>
              <div className="text-xs text-slate-500">{admitted30.length} admissions</div>
            </div>
          </CardHeader>
          <div className="px-3 pb-4">
            <TrendChart data={days} height={330} />
          </div>
        </div>
        <div className="card min-w-0">
          <CardHeader title="Pipeline" subtitle="Leads currently at each stage">
            <Link href="/board" className="text-xs font-medium text-brand-700 hover:underline">
              Open board
            </Link>
          </CardHeader>
          <div className="px-5 pb-5">
            <HBars rows={STATUS_ORDER.filter((s) => s !== "LOST").map((s) => ({ label: STATUS_LABEL[s], value: statusCount[s] ?? 0, href: `/leads?status=${s}` }))} />
            <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
              <span>Lost</span>
              <Link href="/leads?status=LOST" className="font-semibold text-slate-700 hover:underline">
                {statusCount.LOST ?? 0}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Follow-ups + Sources */}
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="card min-w-0 xl:col-span-2">
          <CardHeader title="Calls to make" subtitle="Follow-ups due today and overdue">
            <Link href="/follow-ups" className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
              View all <Icon name="arrowRight" className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          {dueList.length === 0 ? (
            <Empty>All caught up. No follow-ups due.</Empty>
          ) : (
            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {dueList.map((f) => {
                const late = f.dueAt < new Date();
                return (
                  <li key={f.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/60">
                    <Avatar name={f.lead.parentName} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/leads/${f.lead.id}`} className="font-medium text-slate-800 hover:text-brand-700">
                        {f.lead.parentName}
                      </Link>
                      <div className="truncate text-xs text-slate-500">
                        {f.lead.classApplying ?? "Class not set"}
                        {f.note ? ` · ${f.note}` : ""}
                      </div>
                    </div>
                    <span className={`hidden items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium sm:inline-flex ${late ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}`}>
                      <Icon name="clock" className="h-3.5 w-3.5" />
                      {fmtDateTime(f.dueAt)}
                    </span>
                    <a href={`tel:+91${f.lead.phone}`} className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100" aria-label={`Call ${f.lead.parentName}`}>
                      <Icon name="phone" className="h-4 w-4" />
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="card min-w-0">
          <CardHeader title="Lead sources" subtitle="Last 30 days · admissions & conversion" />
          <div className="px-5 pb-5">{sourceRows.length ? <HBars rows={sourceRows} /> : <Empty>No leads in the last 30 days.</Empty>}</div>
        </div>
      </div>

      {/* Team + Latest */}
      <div className={`grid gap-6 ${team.length ? "xl:grid-cols-2" : ""}`}>
        {team.length > 0 && (
          <div className="card min-w-0">
            <CardHeader title="Team leaderboard" subtitle="Admissions this month · calls today" />
            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {team.map((t, i) => (
                <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                  <span className={`w-5 text-center text-xs font-bold ${i === 0 ? "text-amber-500" : "text-slate-300"}`}>{i + 1}</span>
                  <Avatar name={t.name} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/leads?assigned=${t.id}`} className="text-sm font-medium text-slate-800 hover:text-brand-700">
                      {t.name}
                    </Link>
                    <div className="mt-1.5 h-1.5 w-full max-w-[220px] rounded-full bg-slate-100">
                      <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${(t.adm / maxAdm) * 100}%` }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-right text-xs">
                    <div>
                      <div className="font-semibold tabular-nums text-slate-900">{t.adm}</div>
                      <div className="text-slate-400">admits</div>
                    </div>
                    <div>
                      <div className="font-semibold tabular-nums text-slate-900">{t.calls}</div>
                      <div className="text-slate-400">calls</div>
                    </div>
                    <div>
                      <div className={`font-semibold tabular-nums ${t.overdue ? "text-rose-600" : "text-slate-900"}`}>{t.overdue}</div>
                      <div className="text-slate-400">overdue</div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="card min-w-0">
          <CardHeader title="Latest enquiries">
            <Link href="/leads" className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
              All leads <Icon name="arrowRight" className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          {latest.length === 0 ? (
            <Empty>No leads yet.</Empty>
          ) : (
            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {latest.map((l) => (
                <li key={l.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/60">
                  <Avatar name={l.parentName} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/leads/${l.id}`} className="font-medium text-slate-800 hover:text-brand-700">
                      {l.parentName}
                    </Link>
                    <div className="truncate text-xs text-slate-500">
                      {l.classApplying ?? "—"} · {l.assignedTo?.name ?? "Unassigned"} · {timeAgo(l.createdAt)}
                    </div>
                  </div>
                  <div className="hidden shrink-0 items-center gap-2 sm:flex">
                    <SourceBadge source={l.source} />
                    <StatusBadge status={l.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
