import { prisma } from "./db";
import type { Prisma } from "@prisma/client";

export async function audit(
  userId: string | null,
  action: string,
  entity: string,
  entityId?: string | null,
  details?: Prisma.InputJsonValue,
) {
  await prisma.auditLog.create({ data: { userId, action, entity, entityId, details } });
}
