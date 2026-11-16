"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { LeadSource, LeadStatus } from "@prisma/client";
import { SourceBadge, StatusBadge, Empty } from "@/components/ui";
import { assignLeadsAction, deleteLeadsAction } from "@/app/actions/leads";
import { fmtDateTime, timeAgo, cn } from "@/lib/utils";

type Row = {
  id: string;
  parentName: string;
  childName: string | null;
  phone: string;
  classApplying: string | null;
  area: string | null;
  source: LeadSource;
  status: LeadStatus;
  campaignName: string | null;
  assignedTo: string | null;
  callAttempts: number;
  nextFollowUpAt: string | null;
  createdAt: string;
  duplicateCount: number;
};

export function LeadTable({ leads, users, canAssign, canDelete }: { leads: Row[]; users: { id: string; name: string }[]; canAssign: boolean; canDelete: boolean }) {
  const [sel, setSel] = useState<string[]>([]);
  const [to, setTo] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const bulk = canAssign || canDelete;
  const all = leads.length > 0 && sel.length === leads.length;

  const run = (fn: () => Promise<{ ok?: string; error?: string } | null>) =>
    start(async () => {
      const r = await fn();
      setMsg(r?.error ?? r?.ok ?? null);
      setSel([]);
      router.refresh();
    });

  return (
    <div className="card overflow-hidden">
      {bulk && sel.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-brand-50 px-3 py-2 text-sm">
          <span className="font-medium">{sel.length} selected</span>
          {canAssign && (
            <>
              <select className="input w-auto py-1" value={to} onChange={(e) => setTo(e.target.value)}>
                <option value="">Assign to…</option>
                <option value="__none">— Unassign —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <button className="btn-primary py-1" disabled={!to || pending} onClick={() => run(() => assignLeadsAction(sel, to === "__none" ? null : to))}>
                Assign
              </button>
            </>
          )}
          {canDelete && (
            <button
              className="btn-danger ml-auto py-1"
              disabled={pending}
              onClick={() => confirm(`Move ${sel.length} lead(s) to Trash?`) && run(() => deleteLeadsAction(sel))}
            >
              Delete
            </button>
          )}
        </div>
      )}
      {msg && <div className="border-b border-slate-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</div>}
      <ul className="divide-y divide-slate-100 sm:hidden">
        {leads.map((l) => {
          const overdue = l.nextFollowUpAt && new Date(l.nextFollowUpAt) < new Date();
          return (
            <li key={l.id} className="flex items-start gap-3 px-3 py-3">
              {bulk && <input type="checkbox" className="mt-1" checked={sel.includes(l.id)} onChange={() => setSel(sel.includes(l.id) ? sel.filter((x) => x !== l.id) : [...sel, l.id])} />}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/leads/${l.id}`} className="font-medium text-brand-700">
                    {l.parentName}
                  </Link>
                  <StatusBadge status={l.status} />
                </div>
                <div className="mt-0.5 text-xs text-slate-500">{[l.classApplying, l.childName, l.area].filter(Boolean).join(" · ") || "—"}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                  <SourceBadge source={l.source} />
                  <span className="text-slate-400">{timeAgo(l.createdAt)}</span>
                  {l.nextFollowUpAt && <span className={overdue ? "font-medium text-rose-600" : "text-slate-500"}>⏰ {fmtDateTime(l.nextFollowUpAt)}</span>}
                </div>
              </div>
              <a href={`tel:+91${l.phone}`} className="btn-secondary shrink-0 px-2.5 py-1.5 text-xs">
                📞 Call
              </a>
            </li>
          );
        })}
      </ul>
      <div className="hidden overflow-x-auto sm:block">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {bulk && (
                <th className="th w-8">
                  <input type="checkbox" checked={all} onChange={() => setSel(all ? [] : leads.map((l) => l.id))} />
                </th>
              )}
              <th className="th">Parent / Child</th>
              <th className="th">Mobile</th>
              <th className="th">Class</th>
              <th className="th">Source</th>
              <th className="th">Status</th>
              <th className="th">Assigned</th>
              <th className="th">Next follow-up</th>
              <th className="th">Received</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((l) => {
              const overdue = l.nextFollowUpAt && new Date(l.nextFollowUpAt) < new Date();
              return (
                <tr key={l.id} className="hover:bg-slate-50">
                  {bulk && (
                    <td className="td">
                      <input type="checkbox" checked={sel.includes(l.id)} onChange={() => setSel(sel.includes(l.id) ? sel.filter((x) => x !== l.id) : [...sel, l.id])} />
                    </td>
                  )}
                  <td className="td">
                    <Link href={`/leads/${l.id}`} className="font-medium text-brand-700 hover:underline">
                      {l.parentName}
                    </Link>
                    {l.duplicateCount > 0 && <span className="ml-1.5 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">×{l.duplicateCount + 1}</span>}
                    <div className="text-xs text-slate-500">{[l.childName, l.area].filter(Boolean).join(" · ") || "—"}</div>
                  </td>
                  <td className="td whitespace-nowrap">
                    <a href={`tel:+91${l.phone}`} className="text-slate-700 hover:text-brand-700">
                      {l.phone}
                    </a>
                    <div className="text-xs text-slate-400">{l.callAttempts} call(s)</div>
                  </td>
                  <td className="td whitespace-nowrap">{l.classApplying ?? "—"}</td>
                  <td className="td">
                    <SourceBadge source={l.source} />
                    {l.campaignName && <div className="mt-0.5 max-w-[160px] truncate text-xs text-slate-400">{l.campaignName}</div>}
                  </td>
                  <td className="td">
                    <StatusBadge status={l.status} />
                  </td>
                  <td className="td whitespace-nowrap">{l.assignedTo ?? <span className="text-amber-600">Unassigned</span>}</td>
                  <td className={cn("td whitespace-nowrap", overdue && "font-medium text-rose-600")}>{l.nextFollowUpAt ? fmtDateTime(l.nextFollowUpAt) : "—"}</td>
                  <td className="td whitespace-nowrap text-slate-500" title={fmtDateTime(l.createdAt)}>
                    {timeAgo(l.createdAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {leads.length === 0 && <Empty>No leads match these filters.</Empty>}
    </div>
  );
}
