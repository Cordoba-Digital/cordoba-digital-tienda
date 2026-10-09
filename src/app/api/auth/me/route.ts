import { NextResponse } from "next/server";

import { cookieFromHeader, CUSTOMER_COOKIE } from "@/lib/customer-session";
import { getCustomerFromToken, renewCustomerSessionIfNeeded, setCustomerSessionCookie } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

/**
 * Sesión actual del cliente (para el header y verificaciones livianas). El
 * header la consulta en cada visita, así que acá también se renueva: mientras
 * el cliente siga entrando, no tiene que volver a ingresar.
 */
export async function GET(request: Request) {
  const token = cookieFromHeader(request.headers.get("cookie"), CUSTOMER_COOKIE);
  const customer = await getCustomerFromToken(token);
  if (!customer) {
    return NextResponse.json({ ok: true, user: null });
  }
  const res = NextResponse.json({
    ok: true,
    user: { name: customer.name, email: customer.email, avatarUrl: customer.avatarUrl },
  });
  res.headers.set("Cache-Control", "private, no-store");
  if (token && (await renewCustomerSessionIfNeeded(token))) setCustomerSessionCookie(res, token);
  return res;
}
