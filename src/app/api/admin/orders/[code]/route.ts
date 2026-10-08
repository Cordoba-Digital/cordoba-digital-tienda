import { eq } from "drizzle-orm";

import { db } from "@/db";
import { orderEvents, orderItems, orders } from "@/db/schema";
import { sessionFromCookieHeader, verifyAdminSessionValue } from "@/lib/admin-auth";
import { ADMIN_STATUS_IDS, getAdminOrderDetail } from "@/lib/admin-orders";
import { statusIndex } from "@/lib/pricing";

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

  const patch: Partial<typeof orders.$inferInsert> = {};
  const eventNote = (body.note ?? "").trim().slice(0, 500);

  if (body.status !== undefined) {
    const next = body.status.trim();
    if (!ADMIN_STATUS_IDS.has(next)) {
      return Response.json({ ok: false, error: "Estado inválido." }, { status: 400 });
    }
    // El flujo es lineal hacia adelante; se permite avanzar o repetir el actual
    // (idempotencia del webhook), pero no retroceder.
    if (statusIndex(next) < statusIndex(order.status)) {
      return Response.json({ ok: false, error: `No se puede volver de ${order.status} a ${next}.` }, { status: 400 });
    }
    if (next !== order.status) {
      patch.status = next;
      patch.statusUpdatedAt = new Date();
    }
  }

  if (body.trackingCode !== undefined) {
    patch.trackingCode = body.trackingCode.trim().slice(0, 120);
  }

  if (!patch.status && patch.trackingCode === undefined) {
    return Response.json({ ok: false, error: "Nada para actualizar." }, { status: 400 });
  }

  const [updated] = await db.update(orders).set(patch).where(eq(orders.id, order.id)).returning();
  if (patch.status || eventNote) {
    await db.insert(orderEvents).values({
      orderId: order.id,
      fromStatus: order.status,
      toStatus: patch.status ?? order.status,
      note: eventNote,
    });
  }

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  return Response.json({ ok: true, order: updated, items });
}
