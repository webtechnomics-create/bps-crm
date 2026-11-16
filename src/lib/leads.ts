import type { LeadSource, LeadStatus, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { getSetting, setSetting } from "./settings";
import { normalizePhone } from "./utils";
import { currentSession, SOURCE_LABEL, STATUS_LABEL } from "./constants";
import { sendMetaConversion } from "./meta";

export type LeadInput = {
  parentName: string;
  phone: string;
  altPhone?: string | null;
  email?: string | null;
  childName?: string | null;
  classApplying?: string | null;
  currentSchool?: string | null;
  area?: string | null;
  transportNeeded?: boolean | null;
  siblingInSchool?: boolean;
  session?: string | null;
  notes?: string | null;
  source: LeadSource;
  campaignName?: string | null;
  adsetName?: string | null;
  adName?: string | null;
  formName?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  externalId?: string | null;
  rawPayload?: Prisma.InputJsonValue;
  assignedToId?: string | null;
  createdById?: string | null;
  createdAt?: Date;
};

/** Picks the next counselor in round-robin order (only active counselors with auto-assign on). */
export async function nextRoundRobinUser(): Promise<string | null> {
  const settings = await getSetting("assignment");
  if (settings.mode !== "ROUND_ROBIN") return null;
  const users = await prisma.user.findMany({
    where: { active: true, autoAssign: true, role: "COUNSELOR" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!users.length) return null;
  const idx = users.findIndex((u) => u.id === settings.lastUserId);
  const next = users[(idx + 1) % users.length];
  await setSetting("assignment", { ...settings, lastUserId: next.id });
  return next.id;
}

export type IngestResult = { lead: { id: string }; duplicate: boolean };

/**
 * Single entry point for every new enquiry (webhooks, website form, manual entry, CSV import).
 * - Same phone number already present  -> no new lead, the old one gets a "enquired again" entry.
 * - Same externalId (Meta/Google retry) -> ignored.
 * - Otherwise creates the lead and auto-assigns it.
 */
export async function ingestLead(input: LeadInput, opts: { autoAssign?: boolean } = {}): Promise<IngestResult> {
  const phone = normalizePhone(input.phone);
  if (input.externalId) {
    const byExt = await prisma.lead.findUnique({ where: { externalId: input.externalId }, select: { id: true } });
    if (byExt) return { lead: byExt, duplicate: true };
  }
  if (phone) {
    const existing = await prisma.lead.findFirst({
      where: { phone, deletedAt: null },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      const via = [SOURCE_LABEL[input.source], input.campaignName].filter(Boolean).join(" - ");
      await prisma.$transaction([
        prisma.lead.update({ where: { id: existing.id }, data: { duplicateCount: { increment: 1 } } }),
        prisma.activity.create({
          data: {
            leadId: existing.id,
            type: "SYSTEM",
            userId: input.createdById ?? null,
            content: `Enquired again via ${via}.${input.notes ? " Note: " + input.notes : ""}`,
          },
        }),
      ]);
      return { lead: existing, duplicate: true };
    }
  }

  let assignedToId = input.assignedToId ?? null;
  const manual = !!assignedToId;
  if (!assignedToId && opts.autoAssign !== false) assignedToId = await nextRoundRobinUser();

  const lead = await prisma.lead.create({
    data: {
      ...input,
      phone,
      altPhone: input.altPhone ? normalizePhone(input.altPhone) : null,
      email: input.email?.trim().toLowerCase() || null,
      session: input.session || currentSession(),
      assignedToId,
      activities: {
        create: [
          {
            type: "SYSTEM",
            userId: input.createdById ?? null,
            content: `Lead created from ${SOURCE_LABEL[input.source]}${input.campaignName ? ` (campaign: ${input.campaignName})` : ""}.`,
          },
          ...(assignedToId ? [{ type: "ASSIGNMENT" as const, content: manual ? "Assigned at creation." : "Auto-assigned (round robin).", userId: null }] : []),
        ],
      },
    },
    select: { id: true },
  });
  return { lead, duplicate: false };
}

/** Changes status, writes history, and reports the stage to Meta (Conversions API for CRM). */
export async function changeLeadStatus(leadId: string, to: LeadStatus, userId: string | null, extra?: { lostReason?: string }) {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  if (lead.status === to && !extra?.lostReason) return lead;
  const updated = await prisma.lead.update({
    where: { id: leadId },
    data: {
      status: to,
      lostReason: to === "LOST" ? extra?.lostReason ?? lead.lostReason : null,
      convertedAt: to === "ADMISSION_CONFIRMED" ? new Date() : to === lead.status ? lead.convertedAt : null,
      activities: {
        create: {
          type: "STATUS_CHANGE",
          userId,
          fromStatus: lead.status,
          toStatus: to,
          content:
            `${STATUS_LABEL[lead.status]} → ${STATUS_LABEL[to]}` + (to === "LOST" && extra?.lostReason ? ` (reason: ${extra.lostReason})` : ""),
        },
      },
    },
  });
  // Fire-and-forget; failures are recorded in ConversionEvent.
  sendMetaConversion(updated, to).catch(() => {});
  return updated;
}
