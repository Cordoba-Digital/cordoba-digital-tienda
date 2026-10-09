import { NextResponse } from "next/server";

import {
  ADMIN_OAUTH_COOKIE,
  adminGoogleConfigured,
  adminSessionCookieHeader,
  createAdminSessionValue,
} from "@/lib/admin-auth";
import { isAllowedAdminEmail } from "@/lib/admin-access";
import { logAdminAction } from "@/lib/admin-audit";
import { clientIp, loginBlockedMinutes, recordFailedLogin } from "@/lib/admin-login-guard";
import { cookieFromHeader, OAUTH_STATE_COOKIE, safeEqual, safeNextPath } from "@/lib/customer-session";
import {
  clearCustomerSessionCookie,
  createCustomerSession,
  googleOAuthConfigured,
  googleRedirectUri,
  setCustomerSessionCookie,
  upsertCustomerFromGoogle,
} from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

/**
 * La cookie del admin es `SameSite=Strict`: si la mandamos en un redirect que
 * viene de Google, el navegador no la incluye en el siguiente pedido. Por eso
 * se responde una página mínima que navega sola a `/admin` desde nuestro sitio.
 */
function adminLanding(path: string, setCookie: string[]): Response {
  const target = path.replace(/[^A-Za-z0-9/_\-?=&%.]/g, "");
  const html = `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=${target}"><title>Ingresando…</title><p style="font-family:sans-serif">Ingresando al panel… <a href="${target}">Continuar</a></p>`;
  const res = new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
  for (const cookie of setCookie) res.headers.append("Set-Cookie", cookie);
  return res;
}

const CLEAR_ADMIN_OAUTH = `${ADMIN_OAUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fallback = NextResponse.redirect(new URL("/ingresar?error=oauth", request.url));

  if (!googleOAuthConfigured()) {
    return NextResponse.redirect(new URL("/ingresar?error=config", request.url));
  }

  // El usuario puede cancelar en Google: vuelve con ?error=access_denied.
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const rawCookie = cookieFromHeader(request.headers.get("cookie"), OAUTH_STATE_COOKIE);
  if (!code || !returnedState || !rawCookie) {
    return fallback;
  }
  const dot = rawCookie.indexOf(".");
  const expectedState = dot === -1 ? "" : rawCookie.slice(0, dot);
  const next = safeNextPath(dot === -1 ? null : decodeURIComponent(rawCookie.slice(dot + 1)));
  if (!expectedState || !safeEqual(returnedState, expectedState)) {
    return fallback;
  }
  const adminState = cookieFromHeader(request.headers.get("cookie"), ADMIN_OAUTH_COOKIE);
  const forAdmin = !!adminState && safeEqual(adminState, expectedState);
  const adminFail = (reason: string) => {
    const res = NextResponse.redirect(new URL(`/admin/login?error=${reason}`, request.url));
    res.headers.append("Set-Cookie", CLEAR_ADMIN_OAUTH);
    return res;
  };
  if (forAdmin) {
    if (!adminGoogleConfigured()) return adminFail("config");
    const blocked = await loginBlockedMinutes(clientIp(request));
    if (blocked) return adminFail("bloqueado");
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

    if (forAdmin) {
      const email = profile.email.trim().toLowerCase();
      if (!(await isAllowedAdminEmail(email))) {
        await recordFailedLogin(clientIp(request));
        await logAdminAction(email, {
          action: "ingreso_rechazado",
          entityType: "sesion",
          entityId: clientIp(request),
          summary: `Intento de ingreso con ${email} (no autorizado)`,
        });
        return adminFail("email");
      }
      const session = await createAdminSessionValue(email);
      if (!session) return adminFail("config");
      await logAdminAction(email, { action: "ingreso", entityType: "sesion", entityId: clientIp(request), summary: "Ingresó con Google" });
      const target = next === "/admin" || next.startsWith("/admin/") ? next : "/admin";
      return adminLanding(target, [adminSessionCookieHeader(session), CLEAR_ADMIN_OAUTH]);
    }

    const customer = await upsertCustomerFromGoogle({
      sub: profile.sub,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
    });
    if (customer.isDisabled) {
      return NextResponse.redirect(new URL("/ingresar?error=disabled", request.url));
    }
    const token = await createCustomerSession(customer.id);
    const res = NextResponse.redirect(new URL(next, request.url));
    setCustomerSessionCookie(res, token);
    return res;
  } catch {
    return forAdmin ? adminFail("oauth") : fallback;
  }
}
