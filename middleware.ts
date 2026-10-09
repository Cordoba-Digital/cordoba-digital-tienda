import { NextResponse } from "next/server";

import { decodeAdminSession, sessionFromCookieHeader } from "@/lib/admin-auth";
import { cookieFromHeader, CUSTOMER_COOKIE, looksLikeSessionToken } from "@/lib/customer-session";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * El navegador manda `Origin` en todo POST/PUT/PATCH/DELETE: si no coincide
 * con el host del sitio, el pedido lo armó otra página. Sin `Origin` se mira
 * `Referer`; sin ninguno de los dos, se rechaza.
 */
function sameOrigin(request: Request, url: URL): boolean {
  const source = request.headers.get("origin") ?? request.headers.get("referer");
  if (!source) return false;
  try {
    return new URL(source).host === url.host;
  } catch {
    return false;
  }
}

/** El admin no se cachea, no se indexa y no se puede meter en un iframe ajeno. */
function withAdminHeaders(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Content-Security-Policy", "frame-ancestors 'none'");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Referrer-Policy", "same-origin");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

export async function middleware(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname;

  const isAdminPage = path === "/admin" || path.startsWith("/admin/");
  const isAdminApi = path.startsWith("/api/admin/");
  if (isAdminPage || isAdminApi) {
    // CSRF: toda escritura del admin tiene que venir de este mismo sitio.
    if (isAdminApi && !SAFE_METHODS.has(request.method) && !sameOrigin(request, url)) {
      return withAdminHeaders(NextResponse.json({ ok: false, error: "Origen no permitido." }, { status: 403 }));
    }
    if (path === "/admin/login" || path === "/api/admin/login") return withAdminHeaders(NextResponse.next());
    // Solo firma y vencimiento: la lista de admins se revisa en cada página y ruta (acá no hay base).
    const valid = (await decodeAdminSession(sessionFromCookieHeader(request.headers.get("cookie")))) !== null;
    if (valid) return withAdminHeaders(NextResponse.next());
    if (isAdminApi) {
      return withAdminHeaders(NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 }));
    }
    const login = new URL("/admin/login", url);
    login.searchParams.set("next", path);
    return withAdminHeaders(NextResponse.redirect(login));
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
