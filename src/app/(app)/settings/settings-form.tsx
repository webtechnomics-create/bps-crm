"use client";
import { useActionState } from "react";
import { saveSettingsAction } from "@/app/actions/settings";
import { STATUS_LABEL, STATUS_ORDER } from "@/lib/constants";

export function SettingsForm({ assignmentMode, capiEnabled, capiStages }: { assignmentMode: string; capiEnabled: boolean; capiStages: string[] }) {
  const [state, action, pending] = useActionState(saveSettingsAction, null);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label">How should new leads be assigned?</label>
        <select name="assignmentMode" defaultValue={assignmentMode} className="input sm:w-96">
          <option value="ROUND_ROBIN">Automatically, one by one to each counselor (round robin)</option>
          <option value="MANUAL">Manually by Admin (leads stay unassigned)</option>
        </select>
      </div>
      <div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="capiEnabled" defaultChecked={capiEnabled} />
          Send lead quality back to Meta (Conversions API for CRM)
        </label>
        <p className="mb-2 mt-1 text-xs text-slate-500">When a Facebook/Instagram lead reaches one of these stages, Meta is told, so it can find more parents like that.</p>
        <div className="flex flex-wrap gap-2">
          {STATUS_ORDER.filter((s) => s !== "NEW" && s !== "LOST").map((s) => (
            <label key={s} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1 text-sm">
              <input type="checkbox" name="capiStages" value={s} defaultChecked={capiStages.includes(s)} />
              {STATUS_LABEL[s]}
            </label>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={pending}>
          Save settings
        </button>
        {state?.ok && <span className="text-sm text-emerald-600">{state.ok}</span>}
      </div>
    </form>
  );
}
