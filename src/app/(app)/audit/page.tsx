import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requirePermission("audit:view");
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * 100, take: 100, include: { user: { select: { name: true } } } });
  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Every important action: logins, deletes, assignments, exports, settings changes." />
      <div className="card overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">When</th>
              <th className="th">Who</th>
              <th className="th">Action</th>
              <th className="th">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="td whitespace-nowrap text-xs text-slate-500">{fmtDateTime(l.createdAt)}</td>
                <td className="td whitespace-nowrap">{l.user?.name ?? "System"}</td>
                <td className="td whitespace-nowrap font-mono text-xs">{l.action}</td>
                <td className="td max-w-md truncate text-xs text-slate-500">
                  {l.entity === "lead" && l.entityId ? (
                    <Link href={`/leads/${l.entityId}`} className="text-brand-700">
                      lead
                    </Link>
                  ) : null}{" "}
                  {l.details ? JSON.stringify(l.details) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        {page > 1 && (
          <Link className="btn-secondary" href={`/audit?page=${page - 1}`}>
            ← Newer
          </Link>
        )}
        {logs.length === 100 && (
          <Link className="btn-secondary" href={`/audit?page=${page + 1}`}>
            Older →
          </Link>
        )}
      </div>
    </div>
  );
}
