"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { CallOutcome, LeadSource, LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission, requireUser, type SessionUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { changeLeadStatus, ingestLead } from "@/lib/leads";
import { normalizePhone } from "@/lib/utils";
import { SOURCES, STATUS_ORDER } from "@/lib/constants";

type Result = { error?: string; ok?: string } | null;

async function leadForUser(u: SessionUser, id: string) {
  const lead = await prisma.lead.findFirst({ where: { id, deletedAt: null } });
  if (!lead) throw new Error("Lead not found");
  if (!can(u.role, "lead:view_all") && lead.assignedToId !== u.id) throw new Error("This lead is not assigned to you.");
  return lead;
}

async function recalcNextFollowUp(leadId: string) {
  const next = await prisma.followUp.findFirst({ where: { leadId, done: false }, orderBy: { dueAt: "asc" } });
  await prisma.lead.update({ where: { id: leadId }, data: { nextFollowUpAt: next?.dueAt ?? null } });
}

const s = (v: FormDataEntryValue | null) => {
  const t = String(v ?? "").trim();
  return t || null;
};
const triBool = (v: FormDataEntryValue | null) => (v === "yes" ? true : v === "no" ? false : null);

const leadSchema = z.object({
  parentName: z.string().min(2, "Parent name is required"),
  phone: z.string().refine((p) => normalizePhone(p).length === 10, "Enter a valid 10-digit mobile number"),
  source: z.enum(SOURCES as [LeadSource, ...LeadSource[]]),
});

function readLeadForm(fd: FormData) {
  return {
    parentName: String(fd.get("parentName") ?? "").trim(),
    phone: String(fd.get("phone") ?? "").trim(),
    altPhone: s(fd.get("altPhone")),
    email: s(fd.get("email")),
    childName: s(fd.get("childName")),
    classApplying: s(fd.get("classApplying")),
    currentSchool: s(fd.get("currentSchool")),
    area: s(fd.get("area")),
    transportNeeded: triBool(fd.get("transportNeeded")),
    siblingInSchool: fd.get("siblingInSchool") === "on",
    session: s(fd.get("session")),
    notes: s(fd.get("notes")),
    source: String(fd.get("source") ?? "OTHER") as LeadSource,
    campaignName: s(fd.get("campaignName")),
  };
}

export async function createLeadAction(_: Result, fd: FormData): Promise<Result> {
  const u = await requirePermission("lead:create");
  const data = readLeadForm(fd);
  const v = leadSchema.safeParse(data);
  if (!v.success) return { error: v.error.issues[0].message };
  let assignedToId = s(fd.get("assignedToId"));
  if (!can(u.role, "lead:assign")) assignedToId = u.id; // counselors own what they add
  const r = await ingestLead({ ...data, createdById: u.id, assignedToId });
  await audit(u.id, r.duplicate ? "lead.duplicate" : "lead.create", "lead", r.lead.id);
  if (r.duplicate) redirect(`/leads/${r.lead.id}?dup=1`);
  redirect(`/leads/${r.lead.id}`);
}

export async function updateLeadAction(id: string, _: Result, fd: FormData): Promise<Result> {
  const u = await requirePermission("lead:edit");
  await leadForUser(u, id);
  const data = readLeadForm(fd);
  const v = leadSchema.safeParse(data);
  if (!v.success) return { error: v.error.issues[0].message };
  const phone = normalizePhone(data.phone);
  const clash = await prisma.lead.findFirst({ where: { phone, deletedAt: null, NOT: { id } }, select: { id: true } });
  if (clash) return { error: "Another lead already has this mobile number." };
  await prisma.lead.update({
    where: { id },
    data: { ...data, phone, altPhone: data.altPhone ? normalizePhone(data.altPhone) : null, email: data.email?.toLowerCase() ?? null },
  });
  await audit(u.id, "lead.update", "lead", id);
  revalidatePath(`/leads/${id}`);
  return { ok: "Saved" };
}

export async function changeStatusAction(id: string, status: LeadStatus, lostReason?: string): Promise<Result> {
  const u = await requirePermission("lead:edit");
  await leadForUser(u, id);
  if (!STATUS_ORDER.includes(status)) return { error: "Invalid status" };
  if (status === "LOST" && !lostReason) return { error: "Please choose a reason for Lost." };
  await changeLeadStatus(id, status, u.id, { lostReason });
  await audit(u.id, "lead.status", "lead", id, { status, lostReason });
  revalidatePath(`/leads/${id}`);
  revalidatePath("/board");
  return { ok: "Status updated" };
}

export async function logCallAction(id: string, _: Result, fd: FormData): Promise<Result> {
  const u = await requirePermission("lead:edit");
  const lead = await leadForUser(u, id);
  const outcome = String(fd.get("outcome") ?? "") as CallOutcome;
  if (!outcome) return { error: "Select what happened on the call." };
  const note = s(fd.get("note"));
  const followAt = s(fd.get("followUpAt"));
  const newStatus = s(fd.get("status")) as LeadStatus | null;
  const lostReason = s(fd.get("lostReason")) ?? undefined;
  const now = new Date();
  await prisma.$transaction([
    prisma.activity.create({ data: { leadId: id, userId: u.id, type: "CALL", callOutcome: outcome, content: note } }),
    prisma.lead.update({
      where: { id },
      data: { callAttempts: { increment: 1 }, lastContactedAt: now, firstContactedAt: lead.firstContactedAt ?? now },
    }),
  ]);
  // Close any due follow-ups for this lead, the call took care of them.
  await prisma.followUp.updateMany({ where: { leadId: id, done: false, dueAt: { lte: new Date(now.getTime() + 3600_000) } }, data: { done: true, doneAt: now } });
  if (followAt) {
    await prisma.followUp.create({ data: { leadId: id, userId: lead.assignedToId ?? u.id, dueAt: new Date(followAt), note: note ? `After call: ${note}` : null } });
  }
  await recalcNextFollowUp(id);
  let target = newStatus;
  if (!target && outcome === "CONNECTED" && lead.status === "NEW") target = "CONTACTED";
  if (target && target !== lead.status) {
    if (target === "LOST" && !lostReason) return { error: "Please choose a reason for Lost." };
    await changeLeadStatus(id, target, u.id, { lostReason });
  }
  revalidatePath(`/leads/${id}`);
  return { ok: "Call logged" };
}

export async function addNoteAction(id: string, _: Result, fd: FormData): Promise<Result> {
  const u = await requirePermission("lead:edit");
  await leadForUser(u, id);
  const note = s(fd.get("note"));
  if (!note) return { error: "Write something first." };
  await prisma.activity.create({ data: { leadId: id, userId: u.id, type: "NOTE", content: note } });
  revalidatePath(`/leads/${id}`);
  return { ok: "Note added" };
}

export async function scheduleFollowUpAction(id: string, _: Result, fd: FormData): Promise<Result> {
  const u = await requirePermission("lead:edit");
  const lead = await leadForUser(u, id);
  const at = s(fd.get("dueAt"));
  if (!at) return { error: "Pick a date and time." };
  const note = s(fd.get("note"));
  await prisma.followUp.create({ data: { leadId: id, userId: lead.assignedToId ?? u.id, dueAt: new Date(at), note } });
  await prisma.activity.create({ data: { leadId: id, userId: u.id, type: "FOLLOW_UP", content: `Follow-up scheduled${note ? `: ${note}` : ""}` } });
  await recalcNextFollowUp(id);
  revalidatePath(`/leads/${id}`);
  return { ok: "Follow-up scheduled" };
}

export async function completeFollowUpAction(followUpId: string) {
  const u = await requireUser();
  const f = await prisma.followUp.findUniqueOrThrow({ where: { id: followUpId } });
  await leadForUser(u, f.leadId);
  await prisma.followUp.update({ where: { id: followUpId }, data: { done: true, doneAt: new Date() } });
  await recalcNextFollowUp(f.leadId);
  revalidatePath("/follow-ups");
  revalidatePath(`/leads/${f.leadId}`);
}

export async function assignLeadsAction(ids: string[], userId: string | null): Promise<Result> {
  const u = await requirePermission("lead:assign");
  if (!ids.length) return { error: "No leads selected" };
  let name = "Unassigned";
  if (userId) {
    const to = await prisma.user.findFirst({ where: { id: userId, active: true } });
    if (!to) return { error: "User not found" };
    name = to.name;
  }
  await prisma.$transaction([
    prisma.lead.updateMany({ where: { id: { in: ids } }, data: { assignedToId: userId } }),
    prisma.followUp.updateMany({ where: { leadId: { in: ids }, done: false }, data: { userId } }),
    prisma.activity.createMany({ data: ids.map((leadId) => ({ leadId, userId: u.id, type: "ASSIGNMENT" as const, content: `Assigned to ${name} by ${u.name}` })) }),
  ]);
  await audit(u.id, "lead.assign", "lead", null, { ids, userId });
  revalidatePath("/leads");
  return { ok: `${ids.length} lead(s) assigned to ${name}` };
}

export async function deleteLeadsAction(ids: string[]): Promise<Result> {
  const u = await requirePermission("lead:delete");
  await prisma.lead.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date(), deletedById: u.id } });
  await audit(u.id, "lead.delete", "lead", null, { ids });
  revalidatePath("/leads");
  return { ok: `${ids.length} lead(s) moved to Trash` };
}

export async function deleteLeadAction(id: string) {
  await deleteLeadsAction([id]);
  redirect("/leads");
}

export async function restoreLeadAction(id: string) {
  const u = await requirePermission("lead:restore");
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id } });
  const clash = await prisma.lead.findFirst({ where: { phone: lead.phone, deletedAt: null, NOT: { id } } });
  if (clash) throw new Error("Another active lead has the same phone number. Delete or merge it first.");
  await prisma.lead.update({ where: { id }, data: { deletedAt: null, deletedById: null } });
  await audit(u.id, "lead.restore", "lead", id);
  revalidatePath("/trash");
}

export async function purgeLeadAction(id: string) {
  const u = await requirePermission("lead:purge");
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id } });
  if (!lead.deletedAt) throw new Error("Move the lead to Trash first.");
  await prisma.lead.delete({ where: { id } });
  await audit(u.id, "lead.purge", "lead", id, { parentName: lead.parentName, phone: lead.phone });
  revalidatePath("/trash");
}
