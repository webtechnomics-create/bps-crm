"use client";
import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSpendAction, saveSpendAction, syncMetaSpendAction } from "@/app/actions/spend";

export function SpendForm() {
  const [state, action, pending] = useActionState(saveSpendAction, null);
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-5">
      <input type="month" name="month" className="input" required defaultValue={new Date().toISOString().slice(0, 7)} />
      <select name="platform" className="input">
        <option value="FACEBOOK">Meta (FB + Insta)</option>
        <option value="GOOGLE_ADS">Google Ads</option>
        <option value="OTHER">Other (newspaper, hoarding…)</option>
      </select>
      <input name="campaignName" className="input" placeholder="Campaign name (optional)" />
      <input name="amount" type="number" min="0" step="1" className="input" placeholder="Amount ₹" required />
      <button className="btn-primary" disabled={pending}>
        Save spend
      </button>
      {state && <p className={`text-sm sm:col-span-5 ${state.error ? "text-rose-600" : "text-emerald-600"}`}>{state.error ?? state.ok}</p>}
    </form>
  );
}

export function SpendRow({ s }: { s: { id: string; month: string; platform: string; campaignName: string; amount: string } }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <tr>
      <td className="td">{s.month}</td>
      <td className="td">{s.platform}</td>
      <td className="td">{s.campaignName || <span className="text-slate-400">All campaigns</span>}</td>
      <td className="td text-right tabular-nums">{s.amount}</td>
      <td className="td text-right">
        <button
          disabled={pending}
          className="text-xs text-rose-600 hover:underline"
          onClick={() =>
            confirm("Delete this spend entry?") &&
            start(async () => {
              await deleteSpendAction(s.id);
              router.refresh();
            })
          }
        >
          Delete
        </button>
      </td>
    </tr>
  );
}

export function MetaSyncButton() {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
      <button
        className="btn-secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await syncMetaSpendAction();
            setMsg(r?.error ?? r?.ok ?? null);
            router.refresh();
          })
        }
      >
        {pending ? "Syncing…" : "Sync spend from Meta"}
      </button>
    </div>
  );
}
