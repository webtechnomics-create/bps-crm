import type { Role } from "@prisma/client";

export type Action =
  | "lead:view_all"
  | "lead:create"
  | "lead:edit"
  | "lead:assign"
  | "lead:delete" // soft delete -> trash
  | "lead:restore"
  | "lead:purge" // permanent delete
  | "lead:export"
  | "lead:import"
  | "user:manage" // add / edit counselors & viewers
  | "user:manage_admins" // add / edit admins & super admins
  | "reports:view"
  | "spend:manage"
  | "settings:manage"
  | "audit:view";

const MATRIX: Record<Role, Action[]> = {
  SUPER_ADMIN: [
    "lead:view_all",
    "lead:create",
    "lead:edit",
    "lead:assign",
    "lead:delete",
    "lead:restore",
    "lead:purge",
    "lead:export",
    "lead:import",
    "user:manage",
    "user:manage_admins",
    "reports:view",
    "spend:manage",
    "settings:manage",
    "audit:view",
  ],
  ADMIN: [
    "lead:view_all",
    "lead:create",
    "lead:edit",
    "lead:assign",
    "lead:delete",
    "lead:restore",
    "lead:export",
    "lead:import",
    "user:manage",
    "reports:view",
    "spend:manage",
  ],
  COUNSELOR: ["lead:create", "lead:edit"],
  VIEWER: ["lead:view_all", "reports:view"],
};

export function can(role: Role, action: Action) {
  return MATRIX[role].includes(action);
}

export const PERMISSION_MATRIX = MATRIX;
