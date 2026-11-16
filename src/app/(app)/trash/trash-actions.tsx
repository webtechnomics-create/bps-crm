"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { purgeLeadAction, restoreLeadAction } from "@/app/actions/leads";

export function TrashActions({ id, canPurge }: { id: string; canPurge: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<void>) =>
    start(async () => {
      try {
        await fn();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed");
      }
      router.refresh();
    });
  return (
    <div className="flex justify-end gap-3 whitespace-nowrap text-sm">
      <button disabled={pending} className="text-brand-700 hover:underline" onClick={() => run(() => restoreLeadAction(id))}>
        Restore
      </button>
      {canPurge && (
        <button
          disabled={pending}
          className="text-rose-600 hover:underline"
          onClick={() => confirm("Permanently delete this lead and all its history? This cannot be undone.") && run(() => purgeLeadAction(id))}
        >
          Delete forever
        </button>
      )}
    </div>
  );
}
