/**
 * Auth del panel admin — compatible con Edge Runtime (middleware) y Node.
 *
 * Sin dependencias: el HMAC-SHA256 usa Web Crypto (`crypto.subtle`),
 * disponible tanto en el Edge Runtime como en Node 18+. No usar
 * `node:crypto` acá: rompe el middleware en build y en Vercel.
 */

import { PASSWORD_ACTOR } from "@/lib/admin-actor";

export const ADMIN_COOKIE = "admin_session";
/** Marca que el login con Google en curso es para el admin (guarda el `state`). */
export const ADMIN_OAUTH_COOKIE = "admin_oauth";
/** Sin "Recordarme": 12 horas, una jornada de trabajo. */
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
/**
 * Con "Recordarme": 30 días, y se renueva sola con el uso (ver
 * `shouldRenewAdminSession`). Sigue cortándose al instante si el email sale de
 * `ADMIN_EMAILS` o de Accesos.
 */
const REMEMBER_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Una sesión recordada se renueva como mucho una vez por día. */
const RENEW_AFTER_MS = 24 * 60 * 60 * 1000;

function sessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET?.trim() || process.env.ADMIN_PASSWORD?.trim() || "";
}

/** Dueños del panel (`ADMIN_EMAILS`, separados por coma). Los demás admins están en Accesos. */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"));
}


/** El ingreso con Google necesita la app de Google, la lista de emails y un secreto de sesión. */
export function adminGoogleConfigured(): boolean {
  return (
    adminEmails().length > 0 &&
    sessionSecret().length > 0 &&
    (process.env.GOOGLE_CLIENT_ID?.trim() ?? "").length > 0 &&
    (process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "").length > 0
  );
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

/**
 * Cookie: `<vence>.<firma>.<modo>.<email>`. Modo `r` = recordada (30 días),
 * `s` = jornada (12 h). El email es el de Google; vacío si se entró con la
 * contraseña. La firma cubre vencimiento, modo y email.
 */
export async function createAdminSessionValue(email = "", remember = false): Promise<string | null> {
  const secret = sessionSecret();
  if (!secret) return null;
  const who = email.trim().toLowerCase();
  const mode = remember ? "r" : "s";
  const exp = String(Date.now() + (remember ? REMEMBER_TTL_MS : SESSION_TTL_MS));
  const sig = await hmacHex(secret, `admin:${exp}:${mode}:${who}`);
  return `${exp}.${sig}.${mode}.${who}`;
}

export type AdminSession = { email: string; remember: boolean; expiresAt: number };

/**
 * Valida firma y vencimiento de la cookie y devuelve quién es. No consulta la
 * lista de admins (sirve en el middleware, que corre en Edge sin base): las
 * páginas y rutas usan `readAdminSession` de `admin-session`, que además
 * revisa que el email siga habilitado.
 */
export async function decodeAdminSession(value: string | undefined | null): Promise<AdminSession | null> {
  if (!value) return null;
  const secret = sessionSecret();
  if (!secret) return null;
  const [exp, sig, mode] = value.split(".", 3);
  const email = value.slice(`${exp}.${sig}.${mode}.`.length);
  if (!exp || !/^\d+$/.test(exp) || sig?.length !== 64 || (mode !== "r" && mode !== "s")) return null;
  if (!value.startsWith(`${exp}.${sig}.${mode}.`)) return null;
  if (Number(exp) < Date.now()) return null;
  const expected = await hmacHex(secret, `admin:${exp}:${mode}:${email}`);
  if (!timingSafeEqualText(expected, sig)) return null;
  if (!email && !adminPasswordConfigured()) return null;
  return { email, remember: mode === "r", expiresAt: Number(exp) };
}

/** Una sesión recordada que se usó y se renovó hace más de un día. */
export function shouldRenewAdminSession(session: AdminSession): boolean {
  return session.remember && session.expiresAt - Date.now() < REMEMBER_TTL_MS - RENEW_AFTER_MS;
}

/** Quién hizo el cambio, para el registro de actividad. */
export function adminActorLabel(session: AdminSession | null): string {
  return session?.email || PASSWORD_ACTOR;
}

/**
 * `SameSite=Strict`: el navegador no manda la cookie del admin en pedidos que
 * vienen de otro sitio, que es la primera barrera contra CSRF (la segunda es el
 * chequeo de `Origin` del middleware).
 */
export function adminCookieOptions(remember = false): { httpOnly: true; sameSite: "strict"; path: string; maxAge: number; secure: boolean } {
  return {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: (remember ? REMEMBER_TTL_MS : SESSION_TTL_MS) / 1000,
    secure: process.env.NODE_ENV === "production",
  };
}

/** Header `Set-Cookie` de la sesión del admin. */
export function adminSessionCookieHeader(session: string, remember = false): string {
  const opts = adminCookieOptions(remember);
  return `${ADMIN_COOKIE}=${encodeURIComponent(session)}; Path=${opts.path}; HttpOnly; SameSite=Strict; Max-Age=${opts.maxAge}${opts.secure ? "; Secure" : ""}`;
}
