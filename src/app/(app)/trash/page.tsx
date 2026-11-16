import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PageHeader, StatusBadge, SourceBadge, Empty } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";
import { TrashActions } from "./trash-actions";

export default async function TrashPage() {
  const u = await requirePermission("lead:restore");
  const leads = await prisma.lead.findMany({ where: { deletedAt: { not: null } }, orderBy: { deletedAt: "desc" }, take: 300 });
  const ids = [...new Set(leads.map((l) => l.deletedById).filter(Boolean))] as string[];
  const users = Object.fromEntries((await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((x) => [x.id, x.name]));
  return (
    <div>
      <PageHeader title="Trash" subtitle="Deleted leads stay here and can be restored. Only a Super Admin can delete permanently." />
      <div className="card overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">Lead</th>
              <th className="th">Source</th>
              <th className="th">Status</th>
              <th className="th">Deleted</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((l) => (
              <tr key={l.id}>
                <td className="td">
                  <div className="font-medium">{l.parentName}</div>
                  <div className="text-xs text-slate-500">{l.phone}</div>
                </td>
                <td className="td">
                  <SourceBadge source={l.source} />
                </td>
                <td className="td">
                  <StatusBadge status={l.status} />
                </td>
                <td className="td text-xs text-slate-500">
                  {fmtDateTime(l.deletedAt)} by {users[l.deletedById ?? ""] ?? "?"}
                </td>
                <td className="td text-right">
                  <TrashActions id={l.id} canPurge={can(u.role, "lead:purge")} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {leads.length === 0 && <Empty>Trash is empty.</Empty>}
      </div>
    </div>
  );
}
