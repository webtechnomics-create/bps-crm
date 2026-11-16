"use server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { getSetting, setSetting } from "@/lib/settings";
import { audit } from "@/lib/audit";

export async function saveSettingsAction(_: unknown, fd: FormData) {
  const u = await requirePermission("settings:manage");
  const mode = fd.get("assignmentMode") === "MANUAL" ? "MANUAL" : "ROUND_ROBIN";
  const a = await getSetting("assignment");
  await setSetting("assignment", { ...a, mode });
  const stages = fd.getAll("capiStages").map(String);
  await setSetting("capi", { enabled: fd.get("capiEnabled") === "on", stages });
  await audit(u.id, "settings.update", "settings", null, { mode, stages });
  revalidatePath("/settings");
  return { ok: "Settings saved" };
}
