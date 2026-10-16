import { actorFromRequest, logAdminAction } from "@/lib/admin-audit";
import { sessionFromCookieHeader } from "@/lib/admin-auth";
import { createManualOrder, type ManualOrderInput } from "@/lib/admin-manual-order";
import { verifyAdminSessionValue } from "@/lib/admin-session";
import { appBaseUrl } from "@/lib/mercadopago";

export const dynamic = "force-dynamic";

/**
 * Carga un pedido desde el panel (venta por WhatsApp, teléfono o mostrador).
 * Precio, stock y envío los recalcula el servidor; devuelve el link del
 * pedido para mandárselo al cliente, que paga desde ahí.
 */
export async function POST(request: Request) {
  if (!(await verifyAdminSessionValue(sessionFromCookieHeader(request.headers.get("cookie"))))) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as ManualOrderInput | null;
  if (!body || typeof body !== "object") {
    return Response.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  }
  const result = await createManualOrder(body);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error, errors: result.errors }, { status: result.status });
  }
  await logAdminAction(await actorFromRequest(request), {
    action: "pedido_manual",
    entityType: "pedido",
    entityId: result.code,
    summary: `Cargó el pedido ${result.code} desde el panel`,
  });
  return Response.json({ ok: true, code: result.code, total: result.total, link: `${appBaseUrl(request)}/pedido/${result.code}` });
}
