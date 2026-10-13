import { NextResponse } from "next/server";

import { OAUTH_STATE_COOKIE, OAUTH_STATE_TTL_MS, randomToken, safeAdminPath, safeNextPath } from "@/lib/customer-session";
import { ADMIN_OAUTH_COOKIE, adminGoogleConfigured } from "@/lib/admin-auth";
import { googleOAuthConfigured, googleRedirectUri } from "@/lib/customer-auth";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * Inicia el login con Google (OAuth 2.0 Authorization Code Flow).
 * Guarda `state` aleatorio en cookie httpOnly corta y redirige a Google.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { searchParams } = requestUrl;
  // Google siempre vuelve al dominio de SITE_URL. Si el ingreso arranca en otro
  // (un preview, www, etc.), la cookie de `state` quedaría en el dominio
  // equivocado y el primer intento fallaría: primero se salta al dominio bueno.
  const canonical = new URL(SITE_URL);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? requestUrl.host;
  if (host !== canonical.host) {
    return NextResponse.redirect(new URL(`${requestUrl.pathname}${requestUrl.search}`, canonical));
  }
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
  });
  // En el panel se elige la cuenta; en la tienda Google entra directo con la
  // cuenta ya abierta (un click). Desde "Panel admin" de Mi cuenta llega
  // `hint` con el email ya conocido, así que tampoco se pregunta.
  const hint = forAdmin ? searchParams.get("hint")?.trim() : undefined;
  if (hint) params.set("login_hint", hint);
  else if (forAdmin) params.set("prompt", "select_account");
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
  // `.r`: el admin tildó "Recordarme".
  if (forAdmin) res.cookies.set(ADMIN_OAUTH_COOKIE, searchParams.get("remember") === "1" ? `${state}.r` : state, cookieOptions);
  else res.cookies.delete(ADMIN_OAUTH_COOKIE);
  return res;
}
