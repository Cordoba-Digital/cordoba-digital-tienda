import { cookieFromHeader, CUSTOMER_COOKIE } from "@/lib/customer-session";
import { getCustomerFromToken } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

/** Sesión actual del cliente (para el header y verificaciones livianas). */
export async function GET(request: Request) {
  const token = cookieFromHeader(request.headers.get("cookie"), CUSTOMER_COOKIE);
  const customer = await getCustomerFromToken(token);
  if (!customer) {
    return Response.json({ ok: true, user: null });
  }
  return Response.json({
    ok: true,
    user: { name: customer.name, email: customer.email, avatarUrl: customer.avatarUrl },
  });
}
