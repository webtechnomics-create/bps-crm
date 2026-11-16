import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";
import { prisma } from "./db";
import { can, type Action } from "./permissions";

export const SESSION_COOKIE = "bps_session";
const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET || "insecure-dev-secret");

export type SessionUser = { id: string; name: string; email: string; role: Role };

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function verifyToken(token?: string) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return (payload.sub as string) || null;
  } catch {
    return null;
  }
}

/** Current user, re-checked against the DB on every request (so deactivated users lose access at once). */
export async function getUser(): Promise<SessionUser | null> {
  const id = await verifyToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!id) return null;
  const u = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  if (!u || !u.active) return null;
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

export async function requireUser() {
  const u = await getUser();
  if (!u) redirect("/login");
  return u;
}

export async function requirePermission(action: Action) {
  const u = await requireUser();
  if (!can(u.role, action)) redirect("/forbidden");
  return u;
}

/** Prisma filter limiting which leads a user can see. */
export function leadScope(u: SessionUser) {
  return can(u.role, "lead:view_all") ? {} : { assignedToId: u.id };
}
