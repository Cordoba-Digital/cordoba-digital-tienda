import { NextResponse } from "next/server";

import { OAUTH_STATE_COOKIE, OAUTH_STATE_TTL_MS, randomToken, safeNextPath } from "@/lib/customer-session";
import { ADMIN_OAUTH_COOKIE, adminGoogleConfigured } from "@/lib/admin-auth";
import { googleOAuthConfigured, googleRedirectUri } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

/**
 * Inicia el login con Google (OAuth 2.0 Authorization Code Flow).
 * Guarda `state` aleatorio en cookie httpOnly corta y redirige a Google.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // `?admin=1`: ingreso al panel. Usa la misma app de Google y el mismo
  // callback (no hace falta registrar otra URL en Google Cloud).
  const forAdmin = searchParams.get("admin") === "1";
  if (forAdmin && !adminGoogleConfigured()) {
    return NextResponse.redirect(new URL("/admin/login?error=config", request.url));
  }
  const next = forAdmin ? safeAdminPath(searchParams.get("next")) : safeNextPath(searchParams.get("next"));
  if (!googleOAuthConfigured()) {
    return NextResponse.redirect(new URL(`/ingresar?error=config&next=${encodeURIComponent(next)}`, request.url));
  }
  const clientId = process.env.GOOGLE_CLIENT_ID!.trim();
  const state = randomToken().slice(0, 32);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: OAUTH_STATE_TTL_MS / 1000,
    ...(process.env.NODE_ENV === "production" ? { secure: true as const } : {}),
  };
  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  res.cookies.set(OAUTH_STATE_COOKIE, `${state}.${encodeURIComponent(next)}`, cookieOptions);
  // Marca este intento como ingreso al admin (atada al mismo `state`).
  if (forAdmin) res.cookies.set(ADMIN_OAUTH_COOKIE, state, cookieOptions);
  else res.cookies.delete(ADMIN_OAUTH_COOKIE);
  return res;
}

function safeAdminPath(raw: string | null): string {
  const path = safeNextPath(raw, "/admin");
  return path === "/admin" || path.startsWith("/admin/") ? path : "/admin";
}
