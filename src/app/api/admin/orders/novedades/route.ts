import { sessionFromCookieHeader } from "@/lib/admin-auth";
import { ordersFingerprint } from "@/lib/admin-orders";
import { verifyAdminSessionValue } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

/**
 * Huella de los pedidos, para que la lista y el inicio del panel se
 * actualicen solos cuando entra un pedido o cambia uno. Es de solo lectura.
 */
export async function GET(request: Request) {
  if (!(await verifyAdminSessionValue(sessionFromCookieHeader(request.headers.get("cookie"))))) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  return Response.json({ ok: true, firma: await ordersFingerprint() }, { headers: { "cache-control": "no-store" } });
}
