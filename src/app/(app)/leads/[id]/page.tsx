import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { CALL_OUTCOME_LABEL, ROLE_LABEL, SOURCE_LABEL } from "@/lib/constants";
import { SourceBadge, StatusBadge } from "@/components/ui";
import { fmtDate, fmtDateTime } from "@/lib/utils";
import { LeadForm } from "../lead-form";
import { updateLeadAction, deleteLeadAction } from "@/app/actions/leads";
import { CallPanel, StatusPanel, NotePanel, FollowUpPanel, AssignPanel, FollowUpDone } from "./panels";

export default async function LeadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ dup?: string; edit?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const u = await requireUser();
  const lead = await prisma.lead.findFirst({
    where: { id, deletedAt: null },
    include: {
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      activities: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true, role: true } } } },
      followUps: { orderBy: { dueAt: "asc" }, where: { done: false }, include: { user: { select: { name: true } } } },
      conversionEvents: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
  if (!lead) notFound();
  if (!can(u.role, "lead:view_all") && lead.assignedToId !== u.id) notFound();
  const canEdit = can(u.role, "lead:edit");
  const users = can(u.role, "lead:assign")
    ? await prisma.user.findMany({ where: { active: true, role: { in: ["COUNSELOR", "ADMIN", "SUPER_ADMIN"] } }, orderBy: { name: "asc" }, select: { id: true, name: true } })
    : [];
  const wa = `https://wa.me/91${lead.phone}`;

  const info: [string, React.ReactNode][] = [
    ["Mobile", <a key="p" href={`tel:+91${lead.phone}`} className="text-brand-700">{lead.phone}</a>],
    ["Alt. mobile", lead.altPhone],
    ["Email", lead.email],
    ["Child", lead.childName],
    ["Class", lead.classApplying],
    ["Current school", lead.currentSchool],
    ["Area", lead.area],
    ["Transport", lead.transportNeeded == null ? null : lead.transportNeeded ? "Yes" : "No"],
    ["Sibling in school", lead.siblingInSchool ? "Yes" : "No"],
    ["Session", lead.session],
    ["Received", fmtDateTime(lead.createdAt)],
    ["Added by", lead.createdBy?.name ?? "Automatic"],
    ["Call attempts", lead.callAttempts],
    ["First contacted", lead.firstContactedAt ? fmtDateTime(lead.firstContactedAt) : null],
    ["Lost reason", lead.lostReason],
  ];
  const attribution: [string, string | null][] = [
    ["Source", SOURCE_LABEL[lead.source]],
    ["Campaign", lead.campaignName],
    ["Ad set", lead.adsetName],
    ["Ad", lead.adName],
    ["Form", lead.formName],
    ["UTM source / medium", [lead.utmSource, lead.utmMedium].filter(Boolean).join(" / ") || null],
    ["GCLID", lead.gclid],
    ["External ID", lead.externalId],
  ];

  return (
    <div>
      <div className="mb-4 text-sm">
        <Link href="/leads" className="text-slate-500 hover:text-brand-700">
          ← All leads
        </Link>
      </div>
      {sp.dup && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This mobile number already existed, so no new lead was created. The enquiry was added to this lead&apos;s history.
        </div>
      )}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{lead.parentName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <StatusBadge status={lead.status} />
            <SourceBadge source={lead.source} />
            {lead.classApplying && <span>{lead.classApplying}</span>}
            {lead.duplicateCount > 0 && <span className="text-amber-700">Enquired {lead.duplicateCount + 1} times</span>}
            <span>· Assigned: {lead.assignedTo?.name ?? "Nobody"}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`tel:+91${lead.phone}`} className="btn-primary">
            📞 Call
          </a>
          <a href={wa} target="_blank" rel="noreferrer" className="btn-secondary">
            WhatsApp
          </a>
          {canEdit && (
            <Link href={sp.edit ? `/leads/${id}` : `/leads/${id}?edit=1`} className="btn-secondary">
              {sp.edit ? "Close edit" : "Edit"}
            </Link>
          )}
          {can(u.role, "lead:delete") && (
            <form action={deleteLeadAction.bind(null, id)}>
              <button className="btn-ghost text-rose-600">Delete</button>
            </form>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {sp.edit && canEdit ? (
            <div className="card p-5">
              <LeadForm action={updateLeadAction.bind(null, id)} lead={lead} submitLabel="Save changes" />
            </div>
          ) : (
            canEdit && (
              <div className="card p-5">
                <h2 className="mb-3 font-semibold">Log a call</h2>
                <CallPanel leadId={id} status={lead.status} />
              </div>
            )
          )}

          <div className="card">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <h2 className="font-semibold">History</h2>
              <span className="text-xs text-slate-400">{lead.activities.length} entries</span>
            </div>
            {canEdit && (
              <div className="border-b border-slate-100 px-5 py-3">
                <NotePanel leadId={id} />
              </div>
            )}
            <ol className="divide-y divide-slate-100">
              {lead.activities.map((a) => (
                <li key={a.id} className="flex gap-3 px-5 py-3">
                  <div className="mt-0.5 text-lg leading-none">
                    {a.type === "CALL" ? "📞" : a.type === "STATUS_CHANGE" ? "🔀" : a.type === "NOTE" ? "📝" : a.type === "ASSIGNMENT" ? "👤" : a.type === "FOLLOW_UP" ? "⏰" : "⚙️"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">
                      {a.type === "CALL" && <span className="font-medium">{a.callOutcome ? CALL_OUTCOME_LABEL[a.callOutcome] : "Call"}</span>}
                      {a.type === "CALL" && a.content && " — "}
                      <span className="whitespace-pre-wrap">{a.content}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {a.user ? `${a.user.name} (${ROLE_LABEL[a.user.role]})` : "System"} · {fmtDateTime(a.createdAt)}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="space-y-5">
          {canEdit && (
            <div className="card p-4">
              <h3 className="mb-2 text-sm font-semibold">Status</h3>
              <StatusPanel leadId={id} status={lead.status} lostReason={lead.lostReason} />
            </div>
          )}
          {can(u.role, "lead:assign") && (
            <div className="card p-4">
              <h3 className="mb-2 text-sm font-semibold">Assigned to</h3>
              <AssignPanel leadId={id} current={lead.assignedToId} users={users} />
            </div>
          )}
          <div className="card p-4">
            <h3 className="mb-2 text-sm font-semibold">Upcoming follow-ups</h3>
            {lead.followUps.length === 0 && <p className="text-sm text-slate-400">None scheduled.</p>}
            <ul className="mb-3 space-y-2">
              {lead.followUps.map((f) => (
                <li key={f.id} className={`flex items-start justify-between gap-2 rounded-lg border p-2 text-sm ${f.dueAt < new Date() ? "border-rose-200 bg-rose-50" : "border-slate-200"}`}>
                  <div>
                    <div className="font-medium">{fmtDateTime(f.dueAt)}</div>
                    {f.note && <div className="text-xs text-slate-500">{f.note}</div>}
                    <div className="text-xs text-slate-400">{f.user?.name}</div>
                  </div>
                  {canEdit && <FollowUpDone id={f.id} />}
                </li>
              ))}
            </ul>
            {canEdit && <FollowUpPanel leadId={id} />}
          </div>
          <div className="card p-4">
            <h3 className="mb-2 text-sm font-semibold">Details</h3>
            <dl className="space-y-1.5 text-sm">
              {info.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="text-right font-medium">{v ?? <span className="font-normal text-slate-300">—</span>}</dd>
                </div>
              ))}
            </dl>
            {lead.notes && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-sm text-slate-600">{lead.notes}</p>}
          </div>
          <div className="card p-4">
            <h3 className="mb-2 text-sm font-semibold">Marketing attribution</h3>
            <dl className="space-y-1.5 text-sm">
              {attribution.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="shrink-0 text-slate-500">{k}</dt>
                  <dd className="truncate text-right" title={v ?? ""}>
                    {v ?? <span className="text-slate-300">—</span>}
                  </dd>
                </div>
              ))}
            </dl>
            {lead.conversionEvents.length > 0 && (
              <div className="mt-3 border-t border-slate-100 pt-2">
                <div className="mb-1 text-xs font-medium text-slate-500">Sent back to Meta</div>
                {lead.conversionEvents.map((e) => (
                  <div key={e.id} className="flex justify-between text-xs">
                    <span>{e.eventName}</span>
                    <span className={e.status === "SENT" ? "text-emerald-600" : e.status === "FAILED" ? "text-rose-600" : "text-slate-400"}>
                      {e.status} · {fmtDate(e.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
