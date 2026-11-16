import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ingestLead } from "@/lib/leads";
import { normalizePhone } from "@/lib/utils";

function cors(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "";
  const allowed = (process.env.WEBSITE_ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const h: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-api-key",
  };
  if (allowed.includes(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req) });
}

const schema = z.object({
  parentName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(10).max(20),
  email: z.string().trim().email().optional().or(z.literal("")),
  childName: z.string().trim().max(120).optional(),
  classApplying: z.string().trim().max(60).optional(),
  currentSchool: z.string().trim().max(160).optional(),
  area: z.string().trim().max(160).optional(),
  transportNeeded: z.union([z.boolean(), z.string()]).optional(),
  message: z.string().trim().max(2000).optional(),
  utm_source: z.string().max(200).optional(),
  utm_medium: z.string().max(200).optional(),
  utm_campaign: z.string().max(200).optional(),
  gclid: z.string().max(300).optional(),
  fbclid: z.string().max(300).optional(),
  website: z.string().optional(), // honeypot: must stay empty
});

/** Website admission enquiry form posts here (JSON or form-encoded). */
export async function POST(req: NextRequest) {
  const headers = cors(req);
  const key = req.headers.get("x-api-key") ?? req.nextUrl.searchParams.get("key");
  if (!process.env.WEBSITE_FORM_KEY || key !== process.env.WEBSITE_FORM_KEY) {
    return NextResponse.json({ error: "Invalid key" }, { status: 401, headers });
  }
  const ct = req.headers.get("content-type") ?? "";
  const data = ct.includes("application/json")
    ? await req.json().catch(() => ({}))
    : Object.fromEntries((await req.formData().catch(() => new FormData())).entries());
  const parsed = schema.safeParse(data);
  if (!parsed.success) return NextResponse.json({ error: "Please fill name and a valid mobile number." }, { status: 400, headers });
  const d = parsed.data;
  if (d.website) return NextResponse.json({ ok: true }, { headers }); // bot
  if (normalizePhone(d.phone).length !== 10) return NextResponse.json({ error: "Invalid mobile number" }, { status: 400, headers });

  const fromGoogle = !!d.gclid || /google/i.test(d.utm_source ?? "");
  const fromMeta = !!d.fbclid || /facebook|fb|instagram|ig|meta/i.test(d.utm_source ?? "");
  await ingestLead({
    parentName: d.parentName,
    phone: d.phone,
    email: d.email || null,
    childName: d.childName || null,
    classApplying: d.classApplying || null,
    currentSchool: d.currentSchool || null,
    area: d.area || null,
    transportNeeded: d.transportNeeded === undefined ? null : d.transportNeeded === true || /^(yes|true|1|on)$/i.test(String(d.transportNeeded)),
    notes: d.message || null,
    source: "WEBSITE",
    utmSource: d.utm_source || (fromGoogle ? "google" : fromMeta ? "meta" : null),
    utmMedium: d.utm_medium || null,
    utmCampaign: d.utm_campaign || null,
    campaignName: d.utm_campaign || null,
    gclid: d.gclid || null,
    fbclid: d.fbclid || null,
  });
  return NextResponse.json({ ok: true, message: "Thank you! Our admission team will call you shortly." }, { headers });
}
