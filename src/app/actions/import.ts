"use server";
import type { LeadSource } from "@prisma/client";
import { requirePermission } from "@/lib/auth";
import { ingestLead } from "@/lib/leads";
import { audit } from "@/lib/audit";
import { normalizePhone } from "@/lib/utils";
import { SOURCES } from "@/lib/constants";

export type ImportRow = Record<string, string>;

export async function importLeadsAction(rows: ImportRow[], defaultSource: LeadSource, autoAssign: boolean) {
  const u = await requirePermission("lead:import");
  if (rows.length > 5000) return { error: "Max 5000 rows per import." };
  let created = 0,
    duplicates = 0;
  const errors: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const phone = normalizePhone(r.phone);
    if (phone.length !== 10) {
      errors.push(`Row ${i + 2}: invalid mobile "${r.phone ?? ""}"`);
      continue;
    }
    const src = (r.source ?? "").toUpperCase().replace(/[^A-Z]+/g, "_") as LeadSource;
    const t = r.transportNeeded?.toLowerCase();
    try {
      const res = await ingestLead(
        {
          parentName: r.parentName?.trim() || "Unknown",
          phone,
          altPhone: r.altPhone || null,
          email: r.email || null,
          childName: r.childName || null,
          classApplying: r.classApplying || null,
          currentSchool: r.currentSchool || null,
          area: r.area || null,
          transportNeeded: t ? /^(y|yes|true|1|haan)/.test(t) : null,
          notes: r.notes || null,
          campaignName: r.campaignName || null,
          source: SOURCES.includes(src) ? src : defaultSource,
          createdById: u.id,
          createdAt: r.createdAt && !isNaN(Date.parse(r.createdAt)) ? new Date(r.createdAt) : undefined,
        },
        { autoAssign },
      );
      if (res.duplicate) duplicates++;
      else created++;
    } catch (e) {
      errors.push(`Row ${i + 2}: ${String(e).slice(0, 120)}`);
    }
  }
  await audit(u.id, "lead.import", "lead", null, { created, duplicates, errors: errors.length });
  return { created, duplicates, errors: errors.slice(0, 50) };
}
