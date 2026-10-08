/**
 * Auth del panel admin — compatible con Edge Runtime (middleware) y Node.
 *
 * Sin dependencias: el HMAC-SHA256 usa Web Crypto (`crypto.subtle`),
 * disponible tanto en el Edge Runtime como en Node 18+. No usar
 * `node:crypto` acá: rompe el middleware en build y en Vercel.
 */

export const ADMIN_COOKIE = "admin_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET?.trim() || process.env.ADMIN_PASSWORD?.trim() || "";
}

export function adminPasswordConfigured(): boolean {
  return (process.env.ADMIN_PASSWORD?.trim() ?? "").length > 0;
}

function timingSafeEqualText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function verifyAdminPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD?.trim() ?? "";
  if (!expected) return false;
  return timingSafeEqualText(input, expected);
}

async function hmacHex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Extrae el valor de la cookie de admin de un header `Cookie` crudo. */
export function sessionFromCookieHeader(header: string | null): string | null {
  if (!header) return null;
  const match = header
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${ADMIN_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(ADMIN_COOKIE.length + 1)) : null;
}

export async function createAdminSessionValue(): Promise<string | null> {
  const secret = sessionSecret();
  if (!secret) return null;
  const exp = String(Date.now() + SESSION_TTL_MS);
  const sig = await hmacHex(secret, `admin:${exp}`);
  return `${exp}.${sig}`;
}

export async function verifyAdminSessionValue(value: string | undefined | null): Promise<boolean> {
  if (!value) return false;
  const secret = sessionSecret();
  if (!secret) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || sig.length !== 64) return false;
  if (Number(exp) < Date.now()) return false;
  const expected = await hmacHex(secret, `admin:${exp}`);
  return timingSafeEqualText(expected, sig);
}

export function adminCookieOptions(): { httpOnly: true; sameSite: "lax"; path: string; maxAge: number; secure: boolean } {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
    secure: process.env.NODE_ENV === "production",
  };
}
