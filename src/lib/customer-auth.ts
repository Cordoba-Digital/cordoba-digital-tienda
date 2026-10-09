import { and, eq, gt, lt } from "drizzle-orm";
import { cookies } from "next/headers";

import { NextResponse } from "next/server";

import { db } from "@/db";
import { users, userSessions, type User } from "@/db/schema";
import {
  CUSTOMER_COOKIE,
  CUSTOMER_SESSION_TTL_MS,
  randomToken,
  sha256Hex,
} from "@/lib/customer-session";
import { SITE_URL } from "@/lib/site";

export type Customer = Pick<User, "id" | "email" | "name" | "avatarUrl" | "isDisabled" | "createdAt">;

export function googleOAuthConfigured(): boolean {
  return (
    (process.env.GOOGLE_CLIENT_ID?.trim() ?? "").length > 0 &&
    (process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "").length > 0
  );
}

export function googleRedirectUri(): string {
  return `${SITE_URL}/api/auth/google/callback`;
}

/** Crea sesión en DB y devuelve el token crudo para la cookie. */
export async function createCustomerSession(userId: number): Promise<string> {
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  await db.insert(userSessions).values({
    userId,
    tokenHash,
    expiresAt: new Date(Date.now() + CUSTOMER_SESSION_TTL_MS),
  });
  return token;
}

/** Valida el token contra la DB. Null si no existe, expiró o el usuario está deshabilitado. */
export async function getCustomerFromToken(token: string | undefined | null): Promise<Customer | null> {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const tokenHash = await sha256Hex(token);
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
      isDisabled: users.isDisabled,
      createdAt: users.createdAt,
    })
    .from(userSessions)
    .innerJoin(users, eq(users.id, userSessions.userId))
    .where(and(eq(userSessions.tokenHash, tokenHash), gt(userSessions.expiresAt, new Date())))
    .limit(1);
  if (!row || row.isDisabled) return null;
  return row;
}

/** Renovar la sesión cuando le quedan menos de 25 días: en uso, no vence nunca. */
const RENEW_BELOW_MS = 25 * 24 * 60 * 60 * 1000;

/**
 * Corre otra vez los 30 días de la sesión si hace falta. Devuelve `true` si la
 * renovó (entonces hay que volver a mandar la cookie con su nuevo vencimiento).
 */
export async function renewCustomerSessionIfNeeded(token: string | undefined | null): Promise<boolean> {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return false;
  const tokenHash = await sha256Hex(token);
  const renewed = await db
    .update(userSessions)
    .set({ expiresAt: new Date(Date.now() + CUSTOMER_SESSION_TTL_MS) })
    .where(
      and(
        eq(userSessions.tokenHash, tokenHash),
        gt(userSessions.expiresAt, new Date()),
        lt(userSessions.expiresAt, new Date(Date.now() + RENEW_BELOW_MS)),
      ),
    )
    .returning({ id: userSessions.id });
  return renewed.length > 0;
}

export async function revokeCustomerSession(token: string | undefined | null): Promise<void> {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return;
  const tokenHash = await sha256Hex(token);
  await db.delete(userSessions).where(eq(userSessions.tokenHash, tokenHash));
}

/** Cliente actual en un Server Component (null si no hay sesión válida). */
export async function getCurrentCustomer(): Promise<Customer | null> {
  const jar = await cookies();
  return getCustomerFromToken(jar.get(CUSTOMER_COOKIE)?.value ?? null);
}

/** Upsert por `googleSub`. El email se guarda en minúsculas para matchear pedidos invitados. */
export async function upsertCustomerFromGoogle(profile: {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}): Promise<Customer> {
  const email = profile.email.trim().toLowerCase();
  const name = (profile.name ?? "").trim().slice(0, 120) || email;
  const avatarUrl = (profile.picture ?? "").trim().slice(0, 500);
  const [existing] = await db.select().from(users).where(eq(users.googleSub, profile.sub)).limit(1);
  if (existing) {
    const [updated] = await db
      .update(users)
      .set({ email, name, avatarUrl, updatedAt: new Date() })
      .where(eq(users.id, existing.id))
      .returning({ id: users.id, email: users.email, name: users.name, avatarUrl: users.avatarUrl, isDisabled: users.isDisabled, createdAt: users.createdAt });
    // `returning` siempre trae fila: acabamos de leerla.
    return updated!;
  }
  const [created] = await db
    .insert(users)
    .values({ googleSub: profile.sub, email, name, avatarUrl })
    .returning({ id: users.id, email: users.email, name: users.name, avatarUrl: users.avatarUrl, isDisabled: users.isDisabled, createdAt: users.createdAt });
  return created!;
}

function baseCookieOptions(maxAge: number) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    ...(process.env.NODE_ENV === "production" ? { secure: true as const } : {}),
  };
}

export function setCustomerSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set(CUSTOMER_COOKIE, token, baseCookieOptions(CUSTOMER_SESSION_TTL_MS / 1000));
}

export function clearCustomerSessionCookie(res: NextResponse): void {
  res.cookies.set(CUSTOMER_COOKIE, "", baseCookieOptions(0));
}
