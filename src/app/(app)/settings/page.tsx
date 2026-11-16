import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { PageHeader } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";
import { SettingsForm } from "./settings-form";

function Status({ ok }: { ok: boolean }) {
  return ok ? <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700">Configured</span> : <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">Not set</span>;
}

function Code({ children }: { children: string }) {
  return <pre className="mt-1 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{children}</pre>;
}

export default async function SettingsPage() {
  await requirePermission("settings:manage");
  const h = await headers();
  const base = process.env.APP_URL || `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const [assignment, capi, errors, events] = await Promise.all([
    getSetting("assignment"),
    getSetting("capi"),
    prisma.auditLog.findMany({ where: { action: "webhook.error" }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.conversionEvent.groupBy({ by: ["status"], _count: true }),
  ]);
  const env = process.env;
  const snippet = `<form id="bps-enquiry">
  <input name="parentName" placeholder="Parent name" required>
  <input name="phone" placeholder="Mobile number" required>
  <input name="childName" placeholder="Child name">
  <select name="classApplying"><option>Nursery</option><option>Class 1</option>...</select>
  <input name="area" placeholder="Area / village">
  <input name="website" style="display:none" tabindex="-1" autocomplete="off">
  <button>Enquire Now</button>
</form>
<script>
(function () {
  var f = document.getElementById("bps-enquiry");
  var q = new URLSearchParams(location.search);
  ["utm_source","utm_medium","utm_campaign","gclid","fbclid"].forEach(function (k) {
    var v = q.get(k) || sessionStorage.getItem(k);
    if (v) { sessionStorage.setItem(k, v); var i = document.createElement("input");
      i.type = "hidden"; i.name = k; i.value = v; f.appendChild(i); }
  });
  f.addEventListener("submit", function (e) {
    e.preventDefault();
    fetch("${base}/api/webhooks/website", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "YOUR_WEBSITE_FORM_KEY" },
      body: JSON.stringify(Object.fromEntries(new FormData(f)))
    }).then(function (r) { return r.json(); }).then(function (d) {
      f.innerHTML = "<p>" + (d.message || d.error) + "</p>";
    });
  });
})();
</script>`;

  return (
    <div className="max-w-4xl space-y-5">
      <PageHeader title="Settings & Integrations" subtitle="Secrets (tokens, keys) are kept in the server's .env file, never in the database." />

      <div className="card p-5">
        <h2 className="mb-3 font-semibold">Lead assignment & Meta feedback</h2>
        <SettingsForm assignmentMode={assignment.mode} capiEnabled={capi.enabled} capiStages={capi.stages} />
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">1. Website enquiry form</h2>
          <Status ok={!!env.WEBSITE_FORM_KEY} />
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Endpoint: <code className="rounded bg-slate-100 px-1">{base}/api/webhooks/website</code>. Put this code on the admission page of the school website. It also
          captures UTM / GCLID / FBCLID so you know which ad sent the parent. Replace <code>YOUR_WEBSITE_FORM_KEY</code> with the value of{" "}
          <code>WEBSITE_FORM_KEY</code> and add the website address to <code>WEBSITE_ALLOWED_ORIGINS</code>.
        </p>
        <Code>{snippet}</Code>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">2. Meta Lead Ads (Facebook + Instagram)</h2>
          <Status ok={!!(env.META_APP_SECRET && env.META_VERIFY_TOKEN && env.META_PAGE_ACCESS_TOKEN)} />
        </div>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-slate-600">
          <li>developers.facebook.com → Create App (type: Business) → add the <b>Webhooks</b> product.</li>
          <li>
            Webhooks → Page → Callback URL: <code className="rounded bg-slate-100 px-1">{base}/api/webhooks/meta</code>, Verify token = your <code>META_VERIFY_TOKEN</code>. Subscribe to the{" "}
            <b>leadgen</b> field.
          </li>
          <li>
            Get a long-lived <b>Page access token</b> with <code>leads_retrieval</code>, <code>pages_manage_metadata</code>, <code>pages_show_list</code>, <code>pages_read_engagement</code> →{" "}
            <code>META_PAGE_ACCESS_TOKEN</code>. App secret → <code>META_APP_SECRET</code>.
          </li>
          <li>Subscribe the school Page to the app (Graph API: POST /PAGE_ID/subscribed_apps?subscribed_fields=leadgen).</li>
          <li>Business Manager → Integrations → Leads Access → allow this app. Test with the Lead Ads Testing Tool.</li>
        </ol>
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
          <div className="text-sm">
            <b>Conversions API for CRM</b> (send stages back to Meta): dataset <code>META_DATASET_ID</code> + <code>META_CAPI_ACCESS_TOKEN</code>
            <div className="text-xs text-slate-500">Events so far: {events.map((e) => `${e.status} ${e._count}`).join(", ") || "none"}</div>
          </div>
          <Status ok={!!(env.META_DATASET_ID && env.META_CAPI_ACCESS_TOKEN)} />
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
          <div className="text-sm">
            <b>Ad spend sync</b>: <code>META_AD_ACCOUNT_ID</code> + <code>META_ADS_ACCESS_TOKEN</code> (ads_read) → button on Reports page
          </div>
          <Status ok={!!(env.META_AD_ACCOUNT_ID && (env.META_ADS_ACCESS_TOKEN || env.META_CAPI_ACCESS_TOKEN))} />
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">3. Google Ads lead form</h2>
          <Status ok={!!env.GOOGLE_LEAD_FORM_KEY} />
        </div>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-slate-600">
          <li>Google Ads → Campaign → Assets → Lead form → Lead delivery options → Webhook integration.</li>
          <li>
            Webhook URL: <code className="rounded bg-slate-100 px-1">{base}/api/webhooks/google</code>
          </li>
          <li>
            Key: same value as <code>GOOGLE_LEAD_FORM_KEY</code>. Click “Send test data” — a test lead should appear in Leads.
          </li>
        </ol>
        <div className="mt-3 border-t border-slate-100 pt-3 text-sm">
          <b>Offline conversions for Google:</b> leads from the website keep their GCLID. Download this file and upload it in Google Ads → Goals → Conversions → Uploads (create
          a conversion action named <i>Admission Confirmed</i> first).
          <div className="mt-2">
            <a className="btn-secondary" href="/api/conversions/google">
              Download Google offline conversions CSV
            </a>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-2 font-semibold">Recent integration errors</h2>
        {errors.length === 0 ? (
          <p className="text-sm text-slate-400">No errors.</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {errors.map((e) => (
              <li key={e.id} className="rounded bg-rose-50 p-2 text-rose-700">
                {fmtDateTime(e.createdAt)} · {e.entity} {e.entityId}: {JSON.stringify(e.details)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
