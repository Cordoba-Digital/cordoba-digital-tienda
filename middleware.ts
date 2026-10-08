import { NextResponse } from "next/server";

import { sessionFromCookieHeader, verifyAdminSessionValue } from "@/lib/admin-auth";
import { cookieFromHeader, CUSTOMER_COOKIE, looksLikeSessionToken } from "@/lib/customer-session";

export async function middleware(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname;

  const isAdminPage = path === "/admin" || path.startsWith("/admin/");
  const isAdminApi = path.startsWith("/api/admin/");
  if (isAdminPage || isAdminApi) {
    if (path === "/admin/login" || path === "/api/admin/login") return NextResponse.next();
    const valid = await verifyAdminSessionValue(sessionFromCookieHeader(request.headers.get("cookie")));
    if (valid) return NextResponse.next();
    if (isAdminApi) {
      return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
    }
    const login = new URL("/admin/login", url);
    login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }

  // Cuenta del cliente: el middleware solo chequea formato (la sesión vive en
  // la DB y se valida en cada página/API). Sin cookie válida, a /ingresar.
  const isAccountPage = path === "/mi-cuenta" || path.startsWith("/mi-cuenta/");
  if (isAccountPage) {
    const token = cookieFromHeader(request.headers.get("cookie"), CUSTOMER_COOKIE);
    if (looksLikeSessionToken(token)) return NextResponse.next();
    const login = new URL("/ingresar", url);
    login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/mi-cuenta/:path*"],
};
