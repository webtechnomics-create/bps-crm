"use client";
import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { ROLE_LABEL } from "@/lib/constants";
import { saveUserAction, toggleUserActiveAction } from "@/app/actions/users";

type U = { id: string; name: string; email: string; phone: string | null; role: Role; autoAssign: boolean };

export function UserForm({ user, roles }: { user?: U; roles: Role[] }) {
  const [state, action, pending] = useActionState(saveUserAction, null);
  const [role, setRole] = useState<Role>(user?.role ?? "COUNSELOR");
  return (
    <form action={action} className="space-y-3">
      {user && <input type="hidden" name="id" value={user.id} />}
      <div>
        <label className="label">Full name</label>
        <input className="input" name="name" defaultValue={user?.name} required />
      </div>
      <div>
        <label className="label">Email (login ID)</label>
        <input className="input" name="email" type="email" defaultValue={user?.email} required />
      </div>
      <div>
        <label className="label">Mobile</label>
        <input className="input" name="phone" defaultValue={user?.phone ?? ""} />
      </div>
      <div>
        <label className="label">Role</label>
        <select className="input" name="role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {roles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </div>
      {role === "COUNSELOR" && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="autoAssign" defaultChecked={user?.autoAssign ?? true} />
          Include in automatic lead assignment
        </label>
      )}
      <div>
        <label className="label">{user ? "New password (leave blank to keep)" : "Password (min 8 characters)"}</label>
        <input className="input" name="password" type="text" autoComplete="new-password" required={!user} minLength={user ? undefined : 8} />
      </div>
      {state && <p className={`rounded-lg px-3 py-2 text-sm ${state.error ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{state.error ?? state.ok}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        {user ? "Save changes" : "Create user"}
      </button>
    </form>
  );
}

export function ToggleActive({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      disabled={pending}
      className={`text-sm hover:underline ${active ? "text-rose-600" : "text-emerald-600"}`}
      onClick={() =>
        start(async () => {
          const r = await toggleUserActiveAction(id);
          if (r?.error) alert(r.error);
          router.refresh();
        })
      }
    >
      {active ? "Deactivate" : "Activate"}
    </button>
  );
}
