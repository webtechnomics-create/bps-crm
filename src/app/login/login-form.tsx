"use client";
import { useActionState } from "react";
import { login } from "@/app/actions/auth";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label">Email</label>
        <input className="input" name="email" type="email" required autoComplete="username" autoFocus />
      </div>
      <div>
        <label className="label">Password</label>
        <input className="input" name="password" type="password" required autoComplete="current-password" />
      </div>
      {state?.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
