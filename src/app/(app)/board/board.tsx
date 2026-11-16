"use client";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LeadSource, LeadStatus } from "@prisma/client";
import { LOST_REASONS, STATUS_LABEL, STATUS_ORDER } from "@/lib/constants";
import { changeStatusAction } from "@/app/actions/leads";
import { SourceBadge } from "@/components/ui";
import { cn, fmtDateTime } from "@/lib/utils";

type Card = { id: string; parentName: string; classApplying: string | null; status: LeadStatus; source: LeadSource; assignedTo: string | null; nextFollowUpAt: string | null };

export function Board({ leads, canEdit, showClosed }: { leads: Card[]; canEdit: boolean; showClosed: boolean }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [items, move] = useOptimistic(leads, (cur, { id, to }: { id: string; to: LeadStatus }) => cur.map((c) => (c.id === id ? { ...c, status: to } : c)));
  const [over, setOver] = useState<LeadStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const cols = STATUS_ORDER;

  const drop = (id: string, to: LeadStatus) => {
    const card = items.find((c) => c.id === id);
    if (!card || card.status === to) return;
    let reason: string | undefined;
    if (to === "LOST") {
      const r = prompt(`Reason for lost?\n${LOST_REASONS.map((x, i) => `${i + 1}. ${x}`).join("\n")}\n\nType a number or a reason:`);
      if (!r) return;
      reason = LOST_REASONS[Number(r) - 1] ?? r;
    }
    start(async () => {
      move({ id, to });
      const res = await changeStatusAction(id, to, reason);
      setErr(res?.error ?? null);
      router.refresh();
    });
  };

  return (
    <>
      {err && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</p>}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {cols.map((s) => {
          const list = items.filter((c) => c.status === s);
          return (
            <div
              key={s}
              onDragOver={(e) => {
                if (!canEdit) return;
                e.preventDefault();
                setOver(s);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                setOver(null);
                drop(e.dataTransfer.getData("text/plain"), s);
              }}
              className={cn("flex w-64 shrink-0 flex-col rounded-xl bg-slate-100 p-2", over === s && "ring-2 ring-brand-500")}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">{STATUS_LABEL[s]}</span>
                <span className="rounded-full bg-white px-2 text-xs font-medium text-slate-600">{list.length}</span>
              </div>
              <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto">
                {list.map((c) => (
                  <div
                    key={c.id}
                    draggable={canEdit}
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", c.id)}
                    className="cursor-grab rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm active:cursor-grabbing"
                  >
                    <Link href={`/leads/${c.id}`} className="text-sm font-medium text-slate-800 hover:text-brand-700">
                      {c.parentName}
                    </Link>
                    <div className="mt-1 flex items-center justify-between gap-1">
                      <span className="text-xs text-slate-500">{c.classApplying ?? "—"}</span>
                      <SourceBadge source={c.source} />
                    </div>
                    <div className="mt-1 flex justify-between text-[11px] text-slate-400">
                      <span>{c.assignedTo ?? "Unassigned"}</span>
                      {c.nextFollowUpAt && (
                        <span className={new Date(c.nextFollowUpAt) < new Date() ? "font-medium text-rose-600" : ""}>⏰ {fmtDateTime(c.nextFollowUpAt)}</span>
                      )}
                    </div>
                  </div>
                ))}
                {s !== "ADMISSION_CONFIRMED" && s !== "LOST" && list.length === 0 && <div className="p-3 text-center text-xs text-slate-400">Empty</div>}
                {!showClosed && (s === "ADMISSION_CONFIRMED" || s === "LOST") && list.length === 0 && (
                  <div className="p-3 text-center text-xs text-slate-400">Drop here</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
