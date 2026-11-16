import type { LeadSource, LeadStatus, Prisma } from "@prisma/client";
import { leadScope, type SessionUser } from "./auth";
import { startOfTodayIST } from "./utils";

export type LeadParams = {
  q?: string;
  status?: string;
  source?: string;
  assigned?: string;
  cls?: string;
  session?: string;
  from?: string;
  to?: string;
  due?: string;
  page?: string;
  sort?: string;
};

export function buildLeadWhere(u: SessionUser, p: LeadParams): Prisma.LeadWhereInput {
  const and: Prisma.LeadWhereInput[] = [{ deletedAt: null }, leadScope(u)];
  if (p.q) {
    const q = p.q.trim();
    const digits = q.replace(/\D/g, "");
    and.push({
      OR: [
        { parentName: { contains: q, mode: "insensitive" } },
        { childName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { area: { contains: q, mode: "insensitive" } },
        { campaignName: { contains: q, mode: "insensitive" } },
        ...(digits.length >= 4 ? [{ phone: { contains: digits.slice(-10) } }, { altPhone: { contains: digits.slice(-10) } }] : []),
      ],
    });
  }
  if (p.status === "OPEN") and.push({ status: { notIn: ["ADMISSION_CONFIRMED", "LOST"] } });
  else if (p.status) and.push({ status: p.status as LeadStatus });
  if (p.source) and.push({ source: p.source as LeadSource });
  if (p.assigned === "none") and.push({ assignedToId: null });
  else if (p.assigned) and.push({ assignedToId: p.assigned });
  if (p.cls) and.push({ classApplying: p.cls });
  if (p.session) and.push({ session: p.session });
  if (p.from) and.push({ createdAt: { gte: new Date(p.from + "T00:00:00+05:30") } });
  if (p.to) and.push({ createdAt: { lte: new Date(p.to + "T23:59:59+05:30") } });
  const today = startOfTodayIST();
  if (p.due === "overdue") and.push({ nextFollowUpAt: { lt: new Date() } });
  if (p.due === "today") and.push({ nextFollowUpAt: { gte: today, lt: new Date(today.getTime() + 86400_000) } });
  if (p.due === "uncontacted") and.push({ callAttempts: 0, status: "NEW" });
  return { AND: and };
}

export function leadOrder(sort?: string): Prisma.LeadOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest":
      return [{ createdAt: "asc" }];
    case "followup":
      return [{ nextFollowUpAt: { sort: "asc", nulls: "last" } }];
    case "updated":
      return [{ updatedAt: "desc" }];
    default:
      return [{ createdAt: "desc" }];
  }
}
