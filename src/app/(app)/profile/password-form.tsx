"use client";
import { useActionState } from "react";
import { changeOwnPassword } from "@/app/actions/auth";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changeOwnPassword, null);
  return (
    <form action={action} className="space-y-3">
      <input className="input" type="password" name="current" placeholder="Current password" required />
      <input className="input" type="password" name="next" placeholder="New password (min 8)" required minLength={8} />
      {state && <p className={`text-sm ${state.error ? "text-rose-600" : "text-emerald-600"}`}>{state.error ?? state.ok}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        Change password
      </button>
    </form>
  );
}
