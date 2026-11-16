import crypto from "crypto";
import type { Lead, LeadStatus } from "@prisma/client";
import { prisma } from "./db";
import { getSetting } from "./settings";
import { CLASSES } from "./constants";
import type { LeadInput } from "./leads";

const ver = () => process.env.META_GRAPH_VERSION || "v21.0";

export function verifyMetaSignature(rawBody: string, header: string | null) {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return false;
  if (!header?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const got = header.slice(7);
  return got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

type MetaLead = {
  id: string;
  created_time: string;
  field_data: { name: string; values: string[] }[];
  ad_id?: string;
  ad_name?: string;
  adset_name?: string;
  campaign_name?: string;
  form_id?: string;
  platform?: string;
};

export async function fetchMetaLead(leadgenId: string): Promise<MetaLead> {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  if (!token) throw new Error("META_PAGE_ACCESS_TOKEN is not set");
  const url = `https://graph.facebook.com/${ver()}/${leadgenId}?fields=created_time,field_data,ad_id,ad_name,adset_name,campaign_name,form_id,platform&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(`Meta API error: ${JSON.stringify(json.error ?? json)}`);
  return json as MetaLead;
}

/** Best-effort mapping of form questions (standard + custom) to CRM fields. */
export function mapFormFields(fields: { name: string; value: string }[]) {
  const out: Partial<LeadInput> & { extra: string[] } = { extra: [] };
  let first = "",
    last = "";
  for (const { name, value } of fields) {
    if (!value) continue;
    const k = name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    if (k === "full_name" || k === "parent_name" || k === "name" || k.includes("parent") || k.includes("father") || k.includes("mother")) {
      if (!out.parentName) out.parentName = value;
      else out.extra.push(`${name}: ${value}`);
    } else if (k === "first_name") first = value;
    else if (k === "last_name") last = value;
    else if (k.includes("phone") || k.includes("mobile") || k.includes("contact_number") || k.includes("whatsapp")) {
      if (!out.phone) out.phone = value;
      else out.altPhone = value;
    } else if (k.includes("email")) out.email = value;
    else if (k.includes("child") || k.includes("student") || k.includes("ward")) {
      if (k.includes("class") || k.includes("grade")) out.classApplying = matchClass(value);
      else out.childName = value;
    } else if (k.includes("class") || k.includes("grade") || k.includes("admission_for")) out.classApplying = matchClass(value);
    else if (k.includes("school")) out.currentSchool = value;
    else if (k.includes("city") || k.includes("area") || k.includes("location") || k.includes("village") || k.includes("address") || k.includes("locality"))
      out.area = value;
    else if (k.includes("transport") || k.includes("bus")) out.transportNeeded = /yes|haan|required|need/i.test(value);
    else out.extra.push(`${name.replace(/_/g, " ")}: ${value}`);
  }
  if (!out.parentName && (first || last)) out.parentName = `${first} ${last}`.trim();
  return out;
}

function matchClass(v: string) {
  const s = v.toLowerCase().replace(/\s+/g, " ").trim();
  const exact = CLASSES.find((c) => c.toLowerCase() === s);
  if (exact) return exact;
  const num = s.match(/\b(1[0-2]|[1-9])(st|nd|rd|th)?\b/);
  if (num) {
    const c = CLASSES.find((c) => c.toLowerCase().startsWith(`class ${num[1]}`));
    if (c) return c;
  }
  for (const c of ["Pre-Nursery", "Nursery", "LKG", "UKG"]) if (s.includes(c.toLowerCase())) return c;
  return v;
}

export function metaLeadToInput(m: MetaLead): LeadInput {
  const mapped = mapFormFields(m.field_data.map((f) => ({ name: f.name, value: f.values?.join(", ") ?? "" })));
  const { extra, ...rest } = mapped;
  return {
    ...rest,
    parentName: rest.parentName || "Unknown",
    phone: rest.phone || "",
    source: m.platform === "ig" ? "INSTAGRAM" : "FACEBOOK",
    campaignName: m.campaign_name ?? null,
    adsetName: m.adset_name ?? null,
    adName: m.ad_name ?? null,
    formName: m.form_id ?? null,
    externalId: `meta:${m.id}`,
    notes: extra.length ? extra.join("\n") : null,
    rawPayload: m as unknown as object,
    createdAt: m.created_time ? new Date(m.created_time) : undefined,
  };
}

const sha = (v: string) => crypto.createHash("sha256").update(v.trim().toLowerCase()).digest("hex");

/**
 * Conversions API for CRM: tells Meta which leads became real enquiries / admissions so ad
 * delivery optimises for quality parents instead of just form fills.
 */
export async function sendMetaConversion(lead: Lead, stage: LeadStatus) {
  if (lead.source !== "FACEBOOK" && lead.source !== "INSTAGRAM") return;
  if (!lead.externalId?.startsWith("meta:")) return;
  const cfg = await getSetting("capi");
  if (!cfg.enabled || !cfg.stages.includes(stage)) return;
  const dataset = process.env.META_DATASET_ID;
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!dataset || !token) {
    await prisma.conversionEvent.create({
      data: { leadId: lead.id, platform: "META", eventName: stage, status: "SKIPPED", response: "Meta dataset / token not configured" },
    });
    return;
  }
  const user_data: Record<string, unknown> = { lead_id: Number(lead.externalId.slice(5)) };
  if (lead.phone) user_data.ph = [sha(`91${lead.phone}`)];
  if (lead.email) user_data.em = [sha(lead.email)];
  const body = {
    data: [
      {
        event_name: stage.toLowerCase(),
        event_time: Math.floor(Date.now() / 1000),
        action_source: "system_generated",
        user_data,
        custom_data: { event_source: "crm", lead_event_source: "BPS Admission CRM" },
      },
    ],
  };
  try {
    const res = await fetch(`https://graph.facebook.com/${ver()}/${dataset}/events?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    await prisma.conversionEvent.create({
      data: { leadId: lead.id, platform: "META", eventName: stage, status: res.ok ? "SENT" : "FAILED", response: text.slice(0, 2000) },
    });
  } catch (e) {
    await prisma.conversionEvent.create({
      data: { leadId: lead.id, platform: "META", eventName: stage, status: "FAILED", response: String(e).slice(0, 2000) },
    });
  }
}
