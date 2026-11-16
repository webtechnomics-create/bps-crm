import { prisma } from "./db";

export type AssignmentSettings = { mode: "MANUAL" | "ROUND_ROBIN"; lastUserId?: string | null };
export type CapiSettings = { enabled: boolean; stages: string[] };

const DEFAULTS = {
  assignment: { mode: "ROUND_ROBIN", lastUserId: null } as AssignmentSettings,
  capi: { enabled: true, stages: ["INTERESTED", "VISIT_DONE", "ADMISSION_CONFIRMED"] } as CapiSettings,
};
type Key = keyof typeof DEFAULTS;

export async function getSetting<K extends Key>(key: K): Promise<(typeof DEFAULTS)[K]> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return { ...DEFAULTS[key], ...((row?.value as object) ?? {}) } as (typeof DEFAULTS)[K];
}

export async function setSetting<K extends Key>(key: K, value: (typeof DEFAULTS)[K]) {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: value as object },
    update: { value: value as object },
  });
}
