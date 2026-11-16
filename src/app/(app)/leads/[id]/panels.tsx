"use client";
import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LeadStatus } from "@prisma/client";
import { CALL_OUTCOME_LABEL, LOST_REASONS, STATUS_LABEL, STATUS_ORDER } from "@/lib/constants";
import { addNoteAction, assignLeadsAction, changeStatusAction, completeFollowUpAction, logCallAction, scheduleFollowUpAction } from "@/app/actions/leads";

type Result = { error?: string; ok?: string } | null;

function Msg({ s }: { s: Result }) {
  if (!s) return null;
  return <p className={`rounded-lg px-3 py-1.5 text-sm ${s.error ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{s.error ?? s.ok}</p>;
}

function quick(hours: number) {
  const d = new Date(Date.now() + hours * 3600_000);
  if (hours >= 24) d.setHours(11, 0, 0, 0);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

function FollowUpInput({ name }: { name: string }) {
  const [v, setV] = useState("");
  return (
    <div>
      <input type="datetime-local" className="input" name={name} value={v} onChange={(e) => setV(e.target.value)} />
      <div className="mt-1 flex flex-wrap gap-1">
        {[
          ["In 2 hrs", 2],
          ["Tomorrow", 24],
          ["In 3 days", 72],
          ["Next week", 168],
        ].map(([l, h]) => (
          <button type="button" key={l} onClick={() => setV(quick(h as number))} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-200">
            {l}
          </button>
        ))}
        {v && (
          <button type="button" onClick={() => setV("")} className="px-1 text-xs text-slate-400">
            clear
          </button>
        )}
      </div>
    </div>
  );
}

export function CallPanel({ leadId, status }: { leadId: string; status: LeadStatus }) {
  const [state, action, pending] = useActionState(logCallAction.bind(null, leadId), null);
  const [newStatus, setNewStatus] = useState("");
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="label">What happened? *</label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(CALL_OUTCOME_LABEL).map(([k, v]) => (
            <label key={k} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
              <input type="radio" name="outcome" value={k} required className="accent-brand-600" />
              {v}
            </label>
          ))}
        </div>
      </div>
      <div className="sm:col-span-2">
        <label className="label">Conversation notes</label>
        <textarea className="input" name="note" rows={2} placeholder="e.g. Fees discussed, will visit with father on Sunday" />
      </div>
      <div>
        <label className="label">Change status (optional)</label>
        <select className="input" name="status" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
          <option value="">Keep: {STATUS_LABEL[status]}</option>
          {STATUS_ORDER.filter((s) => s !== status).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        {newStatus === "LOST" && (
          <select className="input mt-2" name="lostReason" required defaultValue="">
            <option value="" disabled>
              Reason for lost…
            </option>
            {LOST_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        )}
      </div>
      <div>
        <label className="label">Next follow-up</label>
        <FollowUpInput name="followUpAt" />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save call"}
        </button>
        <Msg s={state} />
      </div>
    </form>
  );
}

export function StatusPanel({ leadId, status, lostReason }: { leadId: string; status: LeadStatus; lostReason: string | null }) {
  const [sel, setSel] = useState<LeadStatus>(status);
  const [reason, setReason] = useState(lostReason ?? "");
  const [msg, setMsg] = useState<Result>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="space-y-2">
      <select className="input" value={sel} onChange={(e) => setSel(e.target.value as LeadStatus)}>
        {STATUS_ORDER.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      {sel === "LOST" && (
        <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="">Reason…</option>
          {LOST_REASONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      )}
      <button
        className="btn-primary w-full"
        disabled={pending || (sel === status && sel !== "LOST")}
        onClick={() =>
          start(async () => {
            setMsg(await changeStatusAction(leadId, sel, reason || undefined));
            router.refresh();
          })
        }
      >
        Update status
      </button>
      <Msg s={msg} />
    </div>
  );
}

export function AssignPanel({ leadId, current, users }: { leadId: string; current: string | null; users: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <select
      className="input"
      defaultValue={current ?? ""}
      disabled={pending}
      onChange={(e) =>
        start(async () => {
          await assignLeadsAction([leadId], e.target.value || null);
          router.refresh();
        })
      }
    >
      <option value="">— Unassigned —</option>
      {users.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name}
        </option>
      ))}
    </select>
  );
}

export function NotePanel({ leadId }: { leadId: string }) {
  const [, action, pending] = useActionState(addNoteAction.bind(null, leadId), null);
  return (
    <form action={action} className="flex gap-2">
      <input className="input" name="note" placeholder="Add a note…" />
      <button className="btn-secondary" disabled={pending}>
        Add
      </button>
    </form>
  );
}

export function FollowUpPanel({ leadId }: { leadId: string }) {
  const [state, action, pending] = useActionState(scheduleFollowUpAction.bind(null, leadId), null);
  return (
    <form action={action} className="space-y-2 border-t border-slate-100 pt-3">
      <FollowUpInput name="dueAt" />
      <input className="input" name="note" placeholder="What to do (optional)" />
      <button className="btn-secondary w-full" disabled={pending}>
        Schedule follow-up
      </button>
      <Msg s={state} />
    </form>
  );
}

export function FollowUpDone({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      className="shrink-0 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-200"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await completeFollowUpAction(id);
          router.refresh();
        })
      }
    >
      Done
    </button>
  );
}
