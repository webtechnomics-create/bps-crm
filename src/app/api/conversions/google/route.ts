import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";

/** CSV in Google Ads "offline conversion import" format (GCLID based). */
export async function GET() {
  const u = await getUser();
  if (!u || !can(u.role, "settings:manage")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const since = new Date(Date.now() - 89 * 86400_000); // Google accepts clicks up to 90 days old
  const leads = await prisma.lead.findMany({
    where: { deletedAt: null, gclid: { not: null }, status: "ADMISSION_CONFIRMED", convertedAt: { gte: since } },
    select: { gclid: true, convertedAt: true },
  });
  const fmt = (d: Date) => {
    const ist = new Date(d.getTime() + 5.5 * 3600_000).toISOString().replace("T", " ").slice(0, 19);
    return `${ist}+0530`;
  };
  const lines = ["Parameters:TimeZone=+0530", "Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency"];
  for (const l of leads) lines.push(`${l.gclid},Admission Confirmed,${fmt(l.convertedAt!)},1,INR`);
  await audit(u.id, "conversions.google_export", "lead", null, { count: leads.length });
  return new NextResponse(lines.join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="google-offline-conversions.csv"` },
  });
}
