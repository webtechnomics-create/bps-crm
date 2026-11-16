"use server";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission, type SessionUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";

type Result = { error?: string; ok?: string } | null;
const ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "COUNSELOR", "VIEWER"];

function mayManage(me: SessionUser, role: Role) {
  if (role === "SUPER_ADMIN" || role === "ADMIN") return can(me.role, "user:manage_admins");
  return can(me.role, "user:manage");
}

export async function saveUserAction(_: Result, fd: FormData): Promise<Result> {
  const me = await requirePermission("user:manage");
  const id = String(fd.get("id") ?? "") || null;
  const name = String(fd.get("name") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const phone = String(fd.get("phone") ?? "").trim() || null;
  const role = String(fd.get("role") ?? "COUNSELOR") as Role;
  const password = String(fd.get("password") ?? "");
  const autoAssign = fd.get("autoAssign") === "on";
  if (!ROLES.includes(role)) return { error: "Invalid role" };
  if (name.length < 2) return { error: "Name is required" };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Valid email is required" };
  if (!mayManage(me, role)) return { error: "Only a Super Admin can create or change Admin / Super Admin users." };

  if (id) {
    const existing = await prisma.user.findUniqueOrThrow({ where: { id } });
    if (!mayManage(me, existing.role)) return { error: "You cannot edit this user." };
    if (existing.id === me.id && role !== existing.role) return { error: "You cannot change your own role." };
    if (password && password.length < 8) return { error: "Password must be at least 8 characters." };
    const clash = await prisma.user.findFirst({ where: { email, NOT: { id } } });
    if (clash) return { error: "Another user has this email." };
    await prisma.user.update({
      where: { id },
      data: { name, email, phone, role, autoAssign, ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}) },
    });
    await audit(me.id, "user.update", "user", id, { role, passwordReset: !!password });
    revalidatePath("/users");
    return { ok: "User updated" };
  }
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (await prisma.user.findUnique({ where: { email } })) return { error: "A user with this email already exists." };
  const u = await prisma.user.create({ data: { name, email, phone, role, autoAssign, passwordHash: await bcrypt.hash(password, 10) } });
  await audit(me.id, "user.create", "user", u.id, { role });
  revalidatePath("/users");
  return { ok: `User ${name} created. Share the email and password with them.` };
}

export async function toggleUserActiveAction(id: string): Promise<Result> {
  const me = await requirePermission("user:manage");
  const u = await prisma.user.findUniqueOrThrow({ where: { id } });
  if (u.id === me.id) return { error: "You cannot deactivate yourself." };
  if (!mayManage(me, u.role)) return { error: "You cannot change this user." };
  if (u.active && u.role === "SUPER_ADMIN") {
    const others = await prisma.user.count({ where: { role: "SUPER_ADMIN", active: true, NOT: { id } } });
    if (!others) return { error: "There must be at least one active Super Admin." };
  }
  await prisma.user.update({ where: { id }, data: { active: !u.active } });
  await audit(me.id, u.active ? "user.deactivate" : "user.activate", "user", id);
  revalidatePath("/users");
  return { ok: u.active ? `${u.name} deactivated` : `${u.name} activated` };
}
