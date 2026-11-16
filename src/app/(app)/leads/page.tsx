import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { buildLeadWhere, leadOrder, type LeadParams } from "@/lib/lead-filters";
import { CLASSES, SOURCES, SOURCE_LABEL, STATUS_LABEL, STATUS_ORDER } from "@/lib/constants";
import { PageHeader } from "@/components/ui";
import { LeadTable } from "./lead-table";

const PER_PAGE = 50;

export default async function LeadsPage({ searchParams }: { searchParams: Promise<LeadParams> }) {
  const u = await requireUser();
  const p = await searchParams;
  const where = buildLeadWhere(u, p);
  const page = Math.max(1, Number(p.page) || 1);
  const [leads, total, users] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: leadOrder(p.sort),
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { assignedTo: { select: { name: true } } },
    }),
    prisma.lead.count({ where }),
    prisma.user.findMany({ where: { active: true, role: { in: ["COUNSELOR", "ADMIN", "SUPER_ADMIN"] } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const qs = (extra: Record<string, string>) => {
    const sp = new URLSearchParams(Object.entries({ ...p, ...extra }).filter(([, v]) => v) as [string, string][]);
    return `?${sp.toString()}`;
  };
  const showAll = can(u.role, "lead:view_all");

  return (
    <div>
      <PageHeader title="Leads" subtitle={`${total.toLocaleString("en-IN")} lead(s)${showAll ? "" : " assigned to you"}`}>
        {can(u.role, "lead:export") && (
          <a className="btn-secondary" href={`/api/leads/export${qs({ page: "" })}`}>
            Export Excel (CSV)
          </a>
        )}
        {can(u.role, "lead:create") && (
          <Link className="btn-primary" href="/leads/new">
            + Add Lead
          </Link>
        )}
      </PageHeader>

      <form className="card mb-4 grid grid-cols-2 gap-2 p-3 sm:grid-cols-4 lg:grid-cols-8">
        <input name="q" defaultValue={p.q} placeholder="Search name / phone / area…" className="input col-span-2" />
        <select name="status" defaultValue={p.status ?? ""} className="input">
          <option value="">All statuses</option>
          <option value="OPEN">Open (not closed)</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select name="source" defaultValue={p.source ?? ""} className="input">
          <option value="">All sources</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABEL[s]}
            </option>
          ))}
        </select>
        <select name="cls" defaultValue={p.cls ?? ""} className="input">
          <option value="">All classes</option>
          {CLASSES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        {showAll ? (
          <select name="assigned" defaultValue={p.assigned ?? ""} className="input">
            <option value="">Anyone</option>
            <option value="none">Unassigned</option>
            {users.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        ) : (
          <span />
        )}
        <select name="due" defaultValue={p.due ?? ""} className="input">
          <option value="">Any follow-up</option>
          <option value="overdue">Follow-up overdue</option>
          <option value="today">Follow-up today</option>
          <option value="uncontacted">Never called</option>
        </select>
        <select name="sort" defaultValue={p.sort ?? ""} className="input">
          <option value="">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="followup">Next follow-up</option>
          <option value="updated">Recently updated</option>
        </select>
        <div className="col-span-2 flex items-center gap-1">
          <input type="date" name="from" defaultValue={p.from} className="input" title="From date" />
          <input type="date" name="to" defaultValue={p.to} className="input" title="To date" />
        </div>
        <div className="col-span-2 flex gap-2 sm:col-span-1 lg:col-span-2">
          <button className="btn-primary flex-1">Filter</button>
          <Link href="/leads" className="btn-secondary">
            Reset
          </Link>
        </div>
      </form>

      <LeadTable
        leads={leads.map((l) => ({
          id: l.id,
          parentName: l.parentName,
          childName: l.childName,
          phone: l.phone,
          classApplying: l.classApplying,
          area: l.area,
          source: l.source,
          status: l.status,
          campaignName: l.campaignName,
          assignedTo: l.assignedTo?.name ?? null,
          callAttempts: l.callAttempts,
          nextFollowUpAt: l.nextFollowUpAt?.toISOString() ?? null,
          createdAt: l.createdAt.toISOString(),
          duplicateCount: l.duplicateCount,
        }))}
        users={users}
        canAssign={can(u.role, "lead:assign")}
        canDelete={can(u.role, "lead:delete")}
      />

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-slate-500">
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link className="btn-secondary" href={qs({ page: String(page - 1) })}>
                ← Previous
              </Link>
            )}
            {page < pages && (
              <Link className="btn-secondary" href={qs({ page: String(page + 1) })}>
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
