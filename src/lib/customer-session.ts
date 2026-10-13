/**
 * Sesión de clientes — parte Edge-safe (middleware y helpers de cookie).
 *
 * Sin imports de DB ni `node:crypto`: usa Web Crypto, igual que `admin-auth`.
 * La sesión es un token aleatorio cuyo hash vive en `user_sessions`; la
 * validación contra la base está en `customer-auth` (solo Node).
 */

export const CUSTOMER_COOKIE = "cd_session";
export const OAUTH_STATE_COOKIE = "cd_oauth_state";

/** 30 días de sesión. */
export const CUSTOMER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** 10 minutos para completar el ida y vuelta a Google. */
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function timingSafeEqualText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqualText(a, b);
}

/** Token aleatorio de 32 bytes en hex (64 chars). */
export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 en hex (para guardar en DB, nunca el token crudo). */
export async function sha256Hex(data: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Extrae el valor de una cookie de un header `Cookie` crudo. */
export function cookieFromHeader(header: string | null, name: string): string | null {
  if (!header) return null;
  const match = header
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

/** Chequeo barato de formato (el middleware no toca la DB). */
export function looksLikeSessionToken(value: string | undefined | null): boolean {
  return !!value && /^[0-9a-f]{64}$/.test(value);
}

/**
 * Solo paths internos (`/mi-cuenta`, nunca `//evil`, `https:` ni `/\evil`).
 * Rechaza también espacios y caracteres de control: el navegador borra un tab
 * o un salto de línea, y `/\t/evil.com` termina siendo `//evil.com`.
 */
export function safeNextPath(raw: string | null | undefined, fallback = "/mi-cuenta"): string {
  if (!raw) return fallback;
  try {
    const decoded = decodeURIComponent(raw);
    if (!decoded.startsWith("/") || decoded.startsWith("//")) return fallback;
    if (/[\s\u0000-\u001f\u007f\\]/.test(decoded)) return fallback;
    const base = "https://tienda.invalid";
    const url = new URL(decoded, base);
    if (url.origin !== base) return fallback;
    return decoded;
  } catch {
    return fallback;
  }
}

/** Igual que `safeNextPath`, pero solo deja volver a páginas del panel. */
export function safeAdminPath(raw: string | null | undefined): string {
  const path = safeNextPath(raw, "/admin");
  return path === "/admin" || path.startsWith("/admin/") || path.startsWith("/admin?") ? path : "/admin";
}
