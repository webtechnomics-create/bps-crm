"use server";
import { revalidatePath } from "next/cache";
import type { LeadSource } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";

type Result = { error?: string; ok?: string } | null;

export async function saveSpendAction(_: Result, fd: FormData): Promise<Result> {
  const u = await requirePermission("spend:manage");
  const month = String(fd.get("month") ?? "");
  const platform = String(fd.get("platform") ?? "") as LeadSource;
  const campaignName = String(fd.get("campaignName") ?? "").trim();
  const amount = Number(fd.get("amount"));
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "Pick a month" };
  if (!(amount >= 0)) return { error: "Enter amount" };
  await prisma.campaignSpend.upsert({
    where: { month_platform_campaignName: { month, platform, campaignName } },
    create: { month, platform, campaignName, amount },
    update: { amount },
  });
  await audit(u.id, "spend.save", "spend", null, { month, platform, campaignName, amount });
  revalidatePath("/reports");
  return { ok: "Saved" };
}

export async function deleteSpendAction(id: string) {
  const u = await requirePermission("spend:manage");
  await prisma.campaignSpend.delete({ where: { id } });
  await audit(u.id, "spend.delete", "spend", id);
  revalidatePath("/reports");
}

/** Pulls monthly campaign spend from the Meta ad account (needs META_AD_ACCOUNT_ID + a token with ads_read). */
export async function syncMetaSpendAction(): Promise<Result> {
  const u = await requirePermission("spend:manage");
  const acc = process.env.META_AD_ACCOUNT_ID;
  const token = process.env.META_ADS_ACCESS_TOKEN || process.env.META_CAPI_ACCESS_TOKEN;
  if (!acc || !token) return { error: "Set META_AD_ACCOUNT_ID and META_ADS_ACCESS_TOKEN in the server .env first." };
  const until = new Date();
  const since = new Date(until.getFullYear(), until.getMonth() - 5, 1);
  const d = (x: Date) => x.toISOString().slice(0, 10);
  const params = new URLSearchParams({
    level: "campaign",
    fields: "campaign_name,spend",
    time_increment: "monthly",
    time_range: JSON.stringify({ since: d(since), until: d(until) }),
    limit: "500",
    access_token: token,
  });
  const res = await fetch(`https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v21.0"}/act_${acc.replace(/^act_/, "")}/insights?${params}`);
  const json = await res.json();
  if (!res.ok) return { error: `Meta error: ${json.error?.message ?? res.status}` };
  let n = 0;
  for (const row of json.data ?? []) {
    const month = String(row.date_start).slice(0, 7);
    const campaignName = row.campaign_name ?? "";
    const amount = Number(row.spend) || 0;
    // Meta reports FB + IG together; stored under FACEBOOK and matched to both in reports.
    await prisma.campaignSpend.upsert({
      where: { month_platform_campaignName: { month, platform: "FACEBOOK", campaignName } },
      create: { month, platform: "FACEBOOK", campaignName, amount },
      update: { amount },
    });
    n++;
  }
  await audit(u.id, "spend.sync_meta", "spend", null, { rows: n });
  revalidatePath("/reports");
  return { ok: `Synced ${n} campaign-month rows from Meta.` };
}
