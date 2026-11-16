"use client";
import { useActionState } from "react";
import type { Lead } from "@prisma/client";
import { CLASSES, SOURCES, SOURCE_LABEL, currentSession } from "@/lib/constants";

type Result = { error?: string; ok?: string } | null;

export function LeadForm({
  action,
  lead,
  users,
  submitLabel = "Save Lead",
}: {
  action: (s: Result, fd: FormData) => Promise<Result>;
  lead?: Partial<Lead>;
  users?: { id: string; name: string }[];
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const tri = lead?.transportNeeded === true ? "yes" : lead?.transportNeeded === false ? "no" : "";
  return (
    <form action={formAction} className="space-y-5">
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold text-slate-700">Parent</legend>
        <div>
          <label className="label">Parent name *</label>
          <input className="input" name="parentName" defaultValue={lead?.parentName ?? ""} required />
        </div>
        <div>
          <label className="label">Mobile *</label>
          <input className="input" name="phone" inputMode="tel" defaultValue={lead?.phone ?? ""} required placeholder="10-digit mobile" />
        </div>
        <div>
          <label className="label">Alternate mobile</label>
          <input className="input" name="altPhone" inputMode="tel" defaultValue={lead?.altPhone ?? ""} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" name="email" type="email" defaultValue={lead?.email ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Area / Village / City</label>
          <input className="input" name="area" defaultValue={lead?.area ?? ""} placeholder="e.g. Madanganj, Kishangarh" />
        </div>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold text-slate-700">Child</legend>
        <div>
          <label className="label">Child name</label>
          <input className="input" name="childName" defaultValue={lead?.childName ?? ""} />
        </div>
        <div>
          <label className="label">Admission for class</label>
          <select className="input" name="classApplying" defaultValue={lead?.classApplying ?? ""}>
            <option value="">— Select —</option>
            {CLASSES.map((c) => (
              <option key={c}>{c}</option>
            ))}
            {lead?.classApplying && !CLASSES.includes(lead.classApplying) && <option>{lead.classApplying}</option>}
          </select>
        </div>
        <div>
          <label className="label">Current school</label>
          <input className="input" name="currentSchool" defaultValue={lead?.currentSchool ?? ""} />
        </div>
        <div>
          <label className="label">Academic session</label>
          <input className="input" name="session" defaultValue={lead?.session ?? currentSession()} />
        </div>
        <div>
          <label className="label">School transport needed?</label>
          <select className="input" name="transportNeeded" defaultValue={tri}>
            <option value="">Not known</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
        <label className="flex items-center gap-2 pt-5 text-sm">
          <input type="checkbox" name="siblingInSchool" defaultChecked={lead?.siblingInSchool ?? false} />
          Sibling already studies in our school
        </label>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold text-slate-700">Source</legend>
        <div>
          <label className="label">Lead source *</label>
          <select className="input" name="source" defaultValue={lead?.source ?? "WALK_IN"}>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Campaign / Reference</label>
          <input className="input" name="campaignName" defaultValue={lead?.campaignName ?? ""} placeholder="optional" />
        </div>
        {users && (
          <div>
            <label className="label">Assign to</label>
            <select className="input" name="assignedToId" defaultValue="">
              <option value="">Auto (round robin)</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <textarea className="input" rows={3} name="notes" defaultValue={lead?.notes ?? ""} />
        </div>
      </fieldset>

      {state?.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>}
      {state?.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.ok}</p>}
      <button className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
