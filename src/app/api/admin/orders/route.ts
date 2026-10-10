import { adminActorLabel, sessionFromCookieHeader } from "@/lib/admin-auth";
import { isOwnerEmail } from "@/lib/admin-access";
import { logAdminAction } from "@/lib/admin-audit";
import { readAdminSession, verifyAdminSessionValue } from "@/lib/admin-session";
import { listAdminOrders } from "@/lib/admin-orders";
import { deleteAllOrders } from "@/lib/order-status";

export const dynamic = "force-dynamic";

async function authorized(request: Request): Promise<boolean> {
  return verifyAdminSessionValue(sessionFromCookieHeader(request.headers.get("cookie")));
}

export async function GET(request: Request) {
  if (!(await authorized(request))) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const result = await listAdminOrders({
    q: searchParams.get("q") ?? "",
    status: searchParams.get("status") ?? "",
    page: Number(searchParams.get("page") ?? 1) || 1,
    perPage: Number(searchParams.get("perPage") ?? 20) || 20,
  });
  return Response.json({ ok: true, ...result });
}

/**
 * Vacía pedidos y pagos. Solo dueños (`ADMIN_EMAILS`) o quien entró con la
 * contraseña, y hay que mandar `{ confirm: "BORRAR" }`.
 */
export async function DELETE(request: Request) {
  const session = await readAdminSession(sessionFromCookieHeader(request.headers.get("cookie")));
  if (!session) return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  if (session.email && !isOwnerEmail(session.email)) {
    return Response.json({ ok: false, error: "Solo los dueños pueden borrar todos los pedidos." }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as { confirm?: unknown };
  if (body.confirm !== "BORRAR") {
    return Response.json({ ok: false, error: "Falta la confirmación." }, { status: 400 });
  }
  const deleted = await deleteAllOrders();
  await logAdminAction(adminActorLabel(session), {
    action: "pedidos_vaciados",
    entityType: "pedido",
    entityId: "todos",
    summary: `Borró todos los pedidos y pagos (${deleted})`,
  });
  return Response.json({ ok: true, deleted });
}
