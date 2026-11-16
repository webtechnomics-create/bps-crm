import { NextResponse, type NextRequest } from "next/server";
import Papa from "papaparse";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { buildLeadWhere, leadOrder, type LeadParams } from "@/lib/lead-filters";
import { SOURCE_LABEL, STATUS_LABEL } from "@/lib/constants";
import { audit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const u = await getUser();
  if (!u || !can(u.role, "lead:export")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const p = Object.fromEntries(req.nextUrl.searchParams) as LeadParams;
  const leads = await prisma.lead.findMany({ where: buildLeadWhere(u, p), orderBy: leadOrder(p.sort), take: 20000, include: { assignedTo: { select: { name: true } } } });
  const csv = Papa.unparse(
    leads.map((l) => ({
      "Received On": l.createdAt.toISOString(),
      "Parent Name": l.parentName,
      Mobile: l.phone,
      "Alt Mobile": l.altPhone ?? "",
      Email: l.email ?? "",
      "Child Name": l.childName ?? "",
      Class: l.classApplying ?? "",
      "Current School": l.currentSchool ?? "",
      Area: l.area ?? "",
      Transport: l.transportNeeded == null ? "" : l.transportNeeded ? "Yes" : "No",
      Session: l.session ?? "",
      Source: SOURCE_LABEL[l.source],
      Campaign: l.campaignName ?? "",
      "Ad Set": l.adsetName ?? "",
      Ad: l.adName ?? "",
      Status: STATUS_LABEL[l.status],
      "Lost Reason": l.lostReason ?? "",
      "Assigned To": l.assignedTo?.name ?? "",
      "Call Attempts": l.callAttempts,
      "Last Contacted": l.lastContactedAt?.toISOString() ?? "",
      "Next Follow-up": l.nextFollowUpAt?.toISOString() ?? "",
      Notes: l.notes ?? "",
    })),
  );
  await audit(u.id, "lead.export", "lead", null, { count: leads.length, filters: p });
  return new NextResponse("﻿" + csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="bps-leads-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
