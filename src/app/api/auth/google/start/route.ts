import { NextResponse } from "next/server";

import { OAUTH_STATE_COOKIE, OAUTH_STATE_TTL_MS, randomToken, safeNextPath } from "@/lib/customer-session";
import { googleOAuthConfigured, googleRedirectUri } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

/**
 * Inicia el login con Google (OAuth 2.0 Authorization Code Flow).
 * Guarda `state` aleatorio en cookie httpOnly corta y redirige a Google.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const next = safeNextPath(searchParams.get("next"));
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
  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  res.cookies.set(OAUTH_STATE_COOKIE, `${state}.${encodeURIComponent(next)}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: OAUTH_STATE_TTL_MS / 1000,
    ...(process.env.NODE_ENV === "production" ? { secure: true as const } : {}),
  });
  return res;
}
