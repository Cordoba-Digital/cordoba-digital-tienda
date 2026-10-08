import { NextResponse } from "next/server";

import { cookieFromHeader, CUSTOMER_COOKIE } from "@/lib/customer-session";
import { clearCustomerSessionCookie, revokeCustomerSession } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

/** Cierra sesión: revoca en DB, limpia la cookie y vuelve al inicio. */
export async function POST(request: Request) {
  const token = cookieFromHeader(request.headers.get("cookie"), CUSTOMER_COOKIE);
  await revokeCustomerSession(token);
  const res = NextResponse.redirect(new URL("/", request.url), 303);
  clearCustomerSessionCookie(res);
  return res;
}
