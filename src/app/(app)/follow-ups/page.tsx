import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser, leadScope } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PageHeader, StatusBadge, Empty } from "@/components/ui";
import { fmtDateTime, startOfTodayIST } from "@/lib/utils";
import { FollowUpDone } from "../leads/[id]/panels";

export default async function FollowUpsPage({ searchParams }: { searchParams: Promise<{ who?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const all = can(u.role, "lead:view_all") && sp.who === "all";
  const today = startOfTodayIST();
  const tomorrow = new Date(today.getTime() + 86400_000);
  const rows = await prisma.followUp.findMany({
    where: { done: false, lead: { deletedAt: null, ...leadScope(u) }, ...(all ? {} : { userId: u.id }) },
    orderBy: { dueAt: "asc" },
    take: 300,
    include: { lead: { select: { id: true, parentName: true, phone: true, status: true, classApplying: true } }, user: { select: { name: true } } },
  });
  const groups = [
    { title: "Overdue", tone: "text-rose-600", items: rows.filter((r) => r.dueAt < today) },
    { title: "Today", tone: "text-brand-700", items: rows.filter((r) => r.dueAt >= today && r.dueAt < tomorrow) },
    { title: "Upcoming", tone: "text-slate-700", items: rows.filter((r) => r.dueAt >= tomorrow) },
  ];
  return (
    <div className="max-w-4xl">
      <PageHeader title="Follow-ups" subtitle={all ? "Everyone's pending follow-ups" : "Your pending follow-ups"}>
        {can(u.role, "lead:view_all") && (
          <div className="flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm">
            <Link href="/follow-ups" className={`rounded-md px-3 py-1 ${!all ? "bg-brand-600 text-white" : ""}`}>
              Mine
            </Link>
            <Link href="/follow-ups?who=all" className={`rounded-md px-3 py-1 ${all ? "bg-brand-600 text-white" : ""}`}>
              Everyone
            </Link>
          </div>
        )}
      </PageHeader>
      <div className="space-y-5">
        {groups.map((g) => (
          <div key={g.title} className="card">
            <div className={`border-b border-slate-200 px-4 py-3 font-semibold ${g.tone}`}>
              {g.title} <span className="text-sm font-normal text-slate-400">({g.items.length})</span>
            </div>
            {g.items.length === 0 ? (
              <Empty>Nothing here.</Empty>
            ) : (
              <ul className="divide-y divide-slate-100">
                {g.items.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link href={`/leads/${f.lead.id}`} className="font-medium text-brand-700 hover:underline">
                          {f.lead.parentName}
                        </Link>
                        <StatusBadge status={f.lead.status} />
                      </div>
                      <div className="text-xs text-slate-500">
                        {fmtDateTime(f.dueAt)} · {f.lead.classApplying ?? "—"} {f.note ? `· ${f.note}` : ""} {all ? `· ${f.user?.name ?? ""}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={`tel:+91${f.lead.phone}`} className="btn-secondary px-2.5 py-1 text-xs">
                        📞 {f.lead.phone}
                      </a>
                      <FollowUpDone id={f.id} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
