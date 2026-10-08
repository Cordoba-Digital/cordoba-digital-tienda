import { cookieFromHeader, OAUTH_STATE_COOKIE, safeEqual, safeNextPath } from "@/lib/customer-session";
import {
  createCustomerSession,
  googleOAuthConfigured,
  googleRedirectUri,
  setCustomerSessionCookie,
  upsertCustomerFromGoogle,
} from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

function clearStateCookie(res: Response): void {
  res.headers.append("Set-Cookie", `${OAUTH_STATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fallback = new URL("/ingresar?error=oauth", request.url);

  if (!googleOAuthConfigured()) {
    return Response.redirect(new URL("/ingresar?error=config", request.url));
  }

  // El usuario puede cancelar en Google: vuelve con ?error=access_denied.
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const rawCookie = cookieFromHeader(request.headers.get("cookie"), OAUTH_STATE_COOKIE);
  if (!code || !returnedState || !rawCookie) {
    return Response.redirect(fallback);
  }
  const dot = rawCookie.indexOf(".");
  const expectedState = dot === -1 ? "" : rawCookie.slice(0, dot);
  const next = safeNextPath(dot === -1 ? null : decodeURIComponent(rawCookie.slice(dot + 1)));
  if (!expectedState || !safeEqual(returnedState, expectedState)) {
    const res = Response.redirect(fallback);
    clearStateCookie(res);
    return res;
  }

  try {
    // code -> tokens (server-side, con client_secret que nunca sale del server).
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
        client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
        redirect_uri: googleRedirectUri(),
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) throw new Error(`token ${tokenRes.status}`);
    const tokens = (await tokenRes.json()) as { access_token?: string };
    if (!tokens.access_token) throw new Error("sin access_token");

    const meRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!meRes.ok) throw new Error(`userinfo ${meRes.status}`);
    const profile = (await meRes.json()) as { sub?: string; email?: string; email_verified?: boolean; name?: string; picture?: string };
    if (!profile.sub || !profile.email || profile.email_verified !== true) throw new Error("perfil incompleto");

    const customer = await upsertCustomerFromGoogle({
      sub: profile.sub,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
    });
    if (customer.isDisabled) {
      const res = Response.redirect(new URL("/ingresar?error=disabled", request.url));
      clearStateCookie(res);
      return res;
    }
    const token = await createCustomerSession(customer.id);
    const res = Response.redirect(new URL(next, request.url));
    setCustomerSessionCookie(res, token);
    clearStateCookie(res);
    return res;
  } catch {
    const res = Response.redirect(fallback);
    clearStateCookie(res);
    return res;
  }
}
