import { eq } from "drizzle-orm";

import { db } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { sessionFromCookieHeader, verifyAdminSessionValue } from "@/lib/admin-auth";
import { actorFromRequest, logAdminAction, type FieldChange } from "@/lib/admin-audit";
import { ADMIN_STATUS_IDS, getAdminOrderDetail } from "@/lib/admin-orders";
import { applyOrderStatus, canTransition } from "@/lib/order-status";
import { statusLabel } from "@/lib/pricing";

export const dynamic = "force-dynamic";

async function authorized(request: Request): Promise<boolean> {
  return verifyAdminSessionValue(sessionFromCookieHeader(request.headers.get("cookie")));
}

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  if (!(await authorized(request))) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  const { code } = await context.params;
  const result = await getAdminOrderDetail(decodeURIComponent(code));
  if (!result) {
    return Response.json({ ok: false, error: "No encontramos un pedido con ese código." }, { status: 404 });
  }
  return Response.json({ ok: true, ...result });
}

export async function PATCH(request: Request, context: { params: Promise<{ code: string }> }) {
  if (!(await authorized(request))) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  const { code } = await context.params;
  const normalized = decodeURIComponent(code).trim().toUpperCase();
  const body = (await request.json().catch(() => ({}))) as { status?: string; trackingCode?: string; note?: string };

  const [order] = await db.select().from(orders).where(eq(orders.code, normalized)).limit(1);
  if (!order) {
    return Response.json({ ok: false, error: "No encontramos un pedido con ese código." }, { status: 404 });
  }

  const eventNote = (body.note ?? "").trim().slice(0, 500);
  let next = order.status;
  if (body.status !== undefined) {
    next = body.status.trim();
    if (!ADMIN_STATUS_IDS.has(next)) {
      return Response.json({ ok: false, error: "Estado inválido." }, { status: 400 });
    }
    // El flujo avanza (o repite el actual, por idempotencia del webhook), se
    // puede cancelar mientras no salió, y un cancelado se puede reactivar.
    const blocked = canTransition(order.status, next);
    if (blocked) return Response.json({ ok: false, error: blocked }, { status: 400 });
  }

  const extra: Partial<typeof orders.$inferInsert> = {};
  if (body.trackingCode !== undefined) {
    extra.trackingCode = body.trackingCode.trim().slice(0, 120);
  }

  if (next === order.status && extra.trackingCode === undefined && !eventNote) {
    return Response.json({ ok: false, error: "Nada para actualizar." }, { status: 400 });
  }

  await applyOrderStatus(order.id, { from: order.status, to: next, note: eventNote, extra });
  const changes: Record<string, FieldChange> = {};
  if (next !== order.status) changes.estado = { from: statusLabel(order.status), to: statusLabel(next) };
  if (extra.trackingCode !== undefined && extra.trackingCode !== (order.trackingCode ?? "")) {
    changes.seguimiento = { from: order.trackingCode ?? "", to: extra.trackingCode };
  }
  if (eventNote) changes.nota = { from: null, to: eventNote };
  await logAdminAction(await actorFromRequest(request), {
    action: "pedido",
    entityType: "pedido",
    entityId: order.code,
    summary:
      next !== order.status
        ? `Pedido ${order.code}: ${statusLabel(order.status)} → ${statusLabel(next)}`
        : `Pedido ${order.code}: ${Object.keys(changes).join(", ") || "actualizado"}`,
    changes,
  });
  const [updated] = await db.select().from(orders).where(eq(orders.id, order.id)).limit(1);
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  return Response.json({ ok: true, order: updated, items });
}
