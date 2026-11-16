import { NextResponse, type NextRequest } from "next/server";
import { fetchMetaLead, metaLeadToInput, verifyMetaSignature } from "@/lib/meta";
import { ingestLead } from "@/lib/leads";
import { audit } from "@/lib/audit";

/** Meta calls this once when you save the webhook, to verify it. */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === process.env.META_VERIFY_TOKEN && process.env.META_VERIFY_TOKEN) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

/** Meta sends { entry: [{ changes: [{ field: "leadgen", value: { leadgen_id, ... } }] }] } */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyMetaSignature(raw, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }
  const body = JSON.parse(raw);
  const results: unknown[] = [];
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "leadgen") continue;
      const id = change.value?.leadgen_id;
      if (!id) continue;
      try {
        const metaLead = await fetchMetaLead(String(id));
        const r = await ingestLead(metaLeadToInput(metaLead));
        results.push({ id, lead: r.lead.id, duplicate: r.duplicate });
      } catch (e) {
        await audit(null, "webhook.error", "meta", String(id), { error: String(e) });
        results.push({ id, error: String(e) });
      }
    }
  }
  // Always 200 so Meta does not keep retrying; errors are in the audit log.
  return NextResponse.json({ ok: true, results });
}
