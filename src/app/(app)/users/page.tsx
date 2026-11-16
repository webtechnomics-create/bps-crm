import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can, PERMISSION_MATRIX, type Action } from "@/lib/permissions";
import { ROLE_LABEL } from "@/lib/constants";
import { PageHeader } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";
import { UserForm, ToggleActive } from "./user-form";
import type { Role } from "@prisma/client";

const ACTION_LABEL: Record<Action, string> = {
  "lead:view_all": "See all leads",
  "lead:create": "Add leads",
  "lead:edit": "Call / update leads",
  "lead:assign": "Assign leads",
  "lead:delete": "Delete (to Trash)",
  "lead:restore": "Restore from Trash",
  "lead:purge": "Permanently delete",
  "lead:export": "Export data",
  "lead:import": "Import leads",
  "user:manage": "Manage counselors / viewers",
  "user:manage_admins": "Manage admins",
  "reports:view": "View reports",
  "spend:manage": "Enter ad spend",
  "settings:manage": "Settings & integrations",
  "audit:view": "Audit log",
};

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const me = await requirePermission("user:manage");
  const sp = await searchParams;
  const users = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }],
    include: { _count: { select: { assignedLeads: { where: { deletedAt: null, status: { notIn: ["ADMISSION_CONFIRMED", "LOST"] } } } } } },
  });
  const editing = users.find((u) => u.id === sp.edit);
  const allowedRoles: Role[] = can(me.role, "user:manage_admins") ? ["SUPER_ADMIN", "ADMIN", "COUNSELOR", "VIEWER"] : ["COUNSELOR", "VIEWER"];
  const roles: Role[] = ["SUPER_ADMIN", "ADMIN", "COUNSELOR", "VIEWER"];

  return (
    <div>
      <PageHeader title="Users & Roles" subtitle="Teachers / counselors who call parents, admins, and management viewers." />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="card overflow-x-auto lg:col-span-2">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">Name</th>
                <th className="th">Role</th>
                <th className="th text-right">Open leads</th>
                <th className="th">Last login</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className={u.active ? "" : "opacity-50"}>
                  <td className="td">
                    <div className="font-medium">
                      {u.name} {!u.active && <span className="text-xs text-rose-600">(inactive)</span>}
                    </div>
                    <div className="text-xs text-slate-500">
                      {u.email}
                      {u.phone ? ` · ${u.phone}` : ""}
                    </div>
                  </td>
                  <td className="td">
                    {ROLE_LABEL[u.role]}
                    {u.role === "COUNSELOR" && <div className="text-xs text-slate-400">{u.autoAssign ? "Gets auto-assigned leads" : "No auto-assign"}</div>}
                  </td>
                  <td className="td text-right tabular-nums">{u._count.assignedLeads}</td>
                  <td className="td text-xs text-slate-500">{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "Never"}</td>
                  <td className="td whitespace-nowrap text-right">
                    {allowedRoles.includes(u.role) && (
                      <>
                        <a href={`/users?edit=${u.id}`} className="mr-3 text-sm text-brand-700 hover:underline">
                          Edit
                        </a>
                        {u.id !== me.id && <ToggleActive id={u.id} active={u.active} />}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card p-4">
          <h2 className="mb-3 font-semibold">{editing ? `Edit ${editing.name}` : "Add user"}</h2>
          <UserForm
            key={editing?.id ?? "new"}
            roles={allowedRoles}
            user={editing ? { id: editing.id, name: editing.name, email: editing.email, phone: editing.phone, role: editing.role, autoAssign: editing.autoAssign } : undefined}
          />
          {editing && (
            <a href="/users" className="mt-2 block text-center text-sm text-slate-500">
              Cancel edit
            </a>
          )}
        </div>
      </div>

      <div className="card mt-5 overflow-x-auto">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold">What each role can do</h2>
        </div>
        <table className="min-w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">Permission</th>
              {roles.map((r) => (
                <th key={r} className="th text-center">
                  {ROLE_LABEL[r]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(Object.keys(ACTION_LABEL) as Action[]).map((a) => (
              <tr key={a}>
                <td className="td">{ACTION_LABEL[a]}</td>
                {roles.map((r) => (
                  <td key={r} className="td text-center">
                    {PERMISSION_MATRIX[r].includes(a) ? <span className="text-emerald-600">✓</span> : <span className="text-slate-300">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-4 py-3 text-xs text-slate-500">Counselors only see the leads assigned to them. Viewers can see everything but cannot change anything.</p>
      </div>
    </div>
  );
}
