import { NextResponse, type NextRequest } from "next/server";
import { mapFormFields } from "@/lib/meta";
import { ingestLead } from "@/lib/leads";
import { audit } from "@/lib/audit";

type GoogleLead = {
  lead_id: string;
  google_key: string;
  is_test?: boolean;
  campaign_id?: number | string;
  form_id?: number | string;
  gcl_id?: string;
  user_column_data?: { column_id?: string; column_name?: string; string_value?: string }[];
};

const COL: Record<string, string> = {
  FULL_NAME: "full_name",
  FIRST_NAME: "first_name",
  LAST_NAME: "last_name",
  PHONE_NUMBER: "phone_number",
  EMAIL: "email",
  CITY: "city",
  POSTAL_CODE: "postal_code",
};

/** Google Ads > Lead form asset > Webhook integration posts here. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as GoogleLead | null;
  if (!body || !process.env.GOOGLE_LEAD_FORM_KEY || body.google_key !== process.env.GOOGLE_LEAD_FORM_KEY) {
    return NextResponse.json({ error: "Invalid key" }, { status: 401 });
  }
  try {
    const fields = (body.user_column_data ?? []).map((c) => ({
      name: (c.column_id && COL[c.column_id]) || c.column_name || c.column_id || "field",
      value: c.string_value ?? "",
    }));
    const { extra, ...m } = mapFormFields(fields);
    const r = await ingestLead({
      ...m,
      parentName: m.parentName || "Unknown",
      phone: m.phone || "",
      source: "GOOGLE_ADS",
      campaignName: body.campaign_id ? `Campaign ${body.campaign_id}` : null,
      formName: body.form_id ? String(body.form_id) : null,
      gclid: body.gcl_id ?? null,
      externalId: `google:${body.lead_id}`,
      notes: [body.is_test ? "TEST LEAD from Google Ads" : null, ...extra].filter(Boolean).join("\n") || null,
      rawPayload: body as unknown as object,
    });
    return NextResponse.json({ ok: true, lead: r.lead.id, duplicate: r.duplicate });
  } catch (e) {
    await audit(null, "webhook.error", "google", body.lead_id, { error: String(e) });
    return NextResponse.json({ error: "Could not save lead" }, { status: 500 });
  }
}
