import { and, eq, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { orderEvents, orderItems, orders, products } from "@/db/schema";
import { ensureCouponSchema, releaseCouponUse, restoreCouponUse } from "@/lib/coupons";
import { CANCELLED_STATUS, isCancelled, statusIndex } from "@/lib/pricing";

/** Horas que un pedido puede quedar sin pago antes de vencer (lo que promete la tienda). */
export const PENDING_EXPIRY_HOURS = 48;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Crea `order_items.stock_reserved` si falta, así el despliegue no depende de
 * correr las migraciones a mano. Idempotente; corre una vez por instancia.
 */
let schemaReady: Promise<void> | null = null;
export function ensureOrderStockSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = db
      .execute(sql`alter table order_items add column if not exists stock_reserved integer not null default 0`)
      .then(() => undefined)
      .catch((error) => {
        schemaReady = null;
        throw error;
      });
  }
  return schemaReady;
}

/**
 * Descuenta el stock de los ítems del pedido y anota cuánto descontó cada uno.
 *
 * El catálogo migrado guarda `stock` como disponibilidad (1 = hay, 0 = no hay)
 * porque la API pública de WooCommerce no da cantidades: si descontáramos
 * siempre, la primera venta dejaría el producto agotado para siempre. Solo se
 * descuenta cuando el stock es una cantidad real (> 1).
 */
export async function reserveOrderStock(tx: Tx, orderId: number): Promise<void> {
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  for (const item of items) {
    const [product] = await tx
      .select({ stock: products.stock })
      .from(products)
      .where(eq(products.slug, item.productSlug))
      .for("update")
      .limit(1);
    const reserved = product && product.stock > 1 ? Math.min(item.quantity, product.stock) : 0;
    await tx
      .update(products)
      .set({ stock: sql`${products.stock} - ${reserved}`, soldCount: sql`${products.soldCount} + ${item.quantity}` })
      .where(eq(products.slug, item.productSlug));
    await tx.update(orderItems).set({ stockReserved: reserved }).where(eq(orderItems.id, item.id));
  }
}

/** Devuelve a la tienda lo que el pedido había descontado. */
async function releaseOrderStock(tx: Tx, orderId: number): Promise<void> {
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  for (const item of items) {
    await tx
      .update(products)
      .set({
        stock: sql`${products.stock} + ${item.stockReserved}`,
        soldCount: sql`greatest(${products.soldCount} - ${item.quantity}, 0)`,
      })
      .where(eq(products.slug, item.productSlug));
    await tx.update(orderItems).set({ stockReserved: 0 }).where(eq(orderItems.id, item.id));
  }
}

/**
 * Regla de transiciones: el flujo avanza (o repite el estado actual), se puede
 * cancelar mientras el pedido no salió, y un cancelado puede reactivarse a
 * cualquier estado (por ejemplo, si el pago llega tarde).
 */
export function canTransition(from: string, to: string): string | null {
  if (from === to) return null;
  if (isCancelled(from)) return null;
  if (isCancelled(to)) {
    return statusIndex(from) >= statusIndex("enviado") ? "No se puede cancelar un pedido que ya salió." : null;
  }
  return statusIndex(to) < statusIndex(from) ? `No se puede volver de ${from} a ${to}.` : null;
}

/**
 * Cambia el estado de un pedido, registra el evento y mueve el stock cuando
 * entra o sale de "Cancelado". `extra` permite guardar otros campos en la
 * misma escritura (código de seguimiento, pago de Mercado Pago). Devuelve
 * false si el pedido ya no estaba en `from` (otro cambio llegó antes).
 */
export async function applyOrderStatus(
  orderId: number,
  input: { from: string; to: string; note?: string; extra?: Partial<typeof orders.$inferInsert> },
): Promise<boolean> {
  await Promise.all([ensureOrderStockSchema(), ensureCouponSchema()]);
  return db.transaction(async (tx) => {
    const changed = input.from !== input.to;
    // Solo aplica si el pedido sigue en `from`. Si dos avisos llegan juntos (el
    // webhook de MP repite notificaciones), el segundo espera al primero, ya no
    // encuentra el estado viejo y no vuelve a mover el stock.
    const updated = await tx
      .update(orders)
      // `status` va siempre (aunque no cambie) para que el update nunca quede
      // vacío: con solo una nota, Drizzle fallaba con "No values to set".
      .set({ ...input.extra, status: input.to, ...(changed ? { statusUpdatedAt: new Date() } : {}) })
      .where(and(eq(orders.id, orderId), eq(orders.status, input.from)))
      .returning({ id: orders.id, couponCode: orders.couponCode });
    if (!updated.length) return false;
    const couponCode = updated[0].couponCode;
    if (changed && isCancelled(input.to)) {
      await releaseOrderStock(tx, orderId);
      if (couponCode) await releaseCouponUse(tx, couponCode);
    }
    if (changed && isCancelled(input.from)) {
      await reserveOrderStock(tx, orderId);
      if (couponCode) await restoreCouponUse(tx, couponCode);
    }
    if (changed || input.note) {
      await tx.insert(orderEvents).values({ orderId, fromStatus: input.from, toStatus: input.to, note: input.note ?? "" });
    }
    return true;
  });
}

/**
 * Cancela los pedidos que siguen en "Pedido recibido" pasadas las horas de
 * reserva y devuelve su stock. Corre desde el cron diario y al abrir el panel,
 * así no depende de que el cron esté activo. Devuelve cuántos venció.
 */
export async function expireStalePendingOrders(): Promise<number> {
  const cutoff = new Date(Date.now() - PENDING_EXPIRY_HOURS * 60 * 60 * 1000);
  const stale = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.status, "pendiente_pago"), lt(orders.createdAt, cutoff)))
    .limit(200);
  for (const order of stale) {
    await applyOrderStatus(order.id, {
      from: "pendiente_pago",
      to: CANCELLED_STATUS.id,
      note: `Vencido: sin pago en ${PENDING_EXPIRY_HOURS} hs.`,
    });
  }
  return stale.length;
}

/**
 * Borra todos los pedidos (y con ellos los pagos, que salen de los pedidos).
 * Antes devuelve a la tienda el stock, las ventas y los usos de cupón que
 * descontaron los que no estaban cancelados, así el catálogo queda como si
 * nunca hubieran existido.
 */
export async function deleteAllOrders(): Promise<number> {
  await Promise.all([ensureOrderStockSchema(), ensureCouponSchema()]);
  return db.transaction(async (tx) => {
    const all = await tx
      .select({ id: orders.id, status: orders.status, couponCode: orders.couponCode })
      .from(orders)
      .for("update");
    for (const order of all) {
      if (isCancelled(order.status)) continue;
      await releaseOrderStock(tx, order.id);
      if (order.couponCode) await releaseCouponUse(tx, order.couponCode);
    }
    await tx.delete(orderEvents);
    await tx.delete(orderItems);
    await tx.delete(orders);
    return all.length;
  });
}
