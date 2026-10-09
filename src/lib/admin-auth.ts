/**
 * Auth del panel admin — compatible con Edge Runtime (middleware) y Node.
 *
 * Sin dependencias: el HMAC-SHA256 usa Web Crypto (`crypto.subtle`),
 * disponible tanto en el Edge Runtime como en Node 18+. No usar
 * `node:crypto` acá: rompe el middleware en build y en Vercel.
 */

export const ADMIN_COOKIE = "admin_session";
/** Marca que el login con Google en curso es para el admin (guarda el `state`). */
export const ADMIN_OAUTH_COOKIE = "admin_oauth";
/** 12 horas: una jornada de trabajo. Una sesión robada deja de servir rápido. */
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

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
 * Cookie: `<vence>.<firma>.<email>`. El email es el de Google; vacío si se
 * entró con la contraseña. La firma cubre vencimiento y email.
 */
export async function createAdminSessionValue(email = ""): Promise<string | null> {
  const secret = sessionSecret();
  if (!secret) return null;
  const who = email.trim().toLowerCase();
  const exp = String(Date.now() + SESSION_TTL_MS);
  const sig = await hmacHex(secret, `admin:${exp}:${who}`);
  return `${exp}.${sig}.${who}`;
}

export type AdminSession = { email: string };

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
  const first = value.indexOf(".");
  const second = value.indexOf(".", first + 1);
  if (first < 1 || second === -1) return null;
  const exp = value.slice(0, first);
  const sig = value.slice(first + 1, second);
  const email = value.slice(second + 1);
  if (!/^\d+$/.test(exp) || sig.length !== 64) return null;
  if (Number(exp) < Date.now()) return null;
  const expected = await hmacHex(secret, `admin:${exp}:${email}`);
  if (!timingSafeEqualText(expected, sig)) return null;
  if (!email && !adminPasswordConfigured()) return null;
  return { email };
}

/** Quién hizo el cambio, para el registro de actividad. */
export function adminActorLabel(session: AdminSession | null): string {
  return session?.email || "contraseña";
}

/**
 * `SameSite=Strict`: el navegador no manda la cookie del admin en pedidos que
 * vienen de otro sitio, que es la primera barrera contra CSRF (la segunda es el
 * chequeo de `Origin` del middleware).
 */
export function adminCookieOptions(): { httpOnly: true; sameSite: "strict"; path: string; maxAge: number; secure: boolean } {
  return {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
    secure: process.env.NODE_ENV === "production",
  };
}

/** Header `Set-Cookie` de la sesión del admin. */
export function adminSessionCookieHeader(session: string): string {
  const opts = adminCookieOptions();
  return `${ADMIN_COOKIE}=${encodeURIComponent(session)}; Path=${opts.path}; HttpOnly; SameSite=Strict; Max-Age=${opts.maxAge}${opts.secure ? "; Secure" : ""}`;
}
