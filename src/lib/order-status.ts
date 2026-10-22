import { and, eq, inArray, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { orderEvents, orderItems, orders, orderStockHolds, products } from "@/db/schema";
import { isAutomationOn } from "@/lib/automations";
import { ensureCouponSchema, releaseCouponUse, restoreCouponUse } from "@/lib/coupons";
import { notifyStatusChange } from "@/lib/order-emails";
import { countedStockSlugs } from "@/lib/price-schedules";
import { CANCELLED_STATUS, isCancelled, isCountedStock, statusIndex } from "@/lib/pricing";
import { ensureStockHoldSchema } from "@/lib/stock-hold-schema";
import { ensureUsdtSchema } from "@/lib/usdt-schema";
import {
  PENDING_EXPIRY_HOURS,
  pendingExpiryHours,
  PICKUP_HOURS,
  SENA_EXPIRY_HOURS,
  STOCK_HOLD_HOURS,
} from "@/lib/payment-rules";

/** Nota del evento de una reserva vencida; el email al cliente la reconoce. */
export const UNCLAIMED_NOTE = `Reserva vencida: no se retiró en ${PICKUP_HOURS} hs desde la seña.`;
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
 * descuenta cuando el stock es una cantidad real (> 1, o 1 en un producto con
 * oferta programada: ver `countedStockSlugs`).
 */
export async function reserveOrderStock(tx: Tx, orderId: number): Promise<void> {
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const counted = await countedStockSlugs(items.map((i) => i.productSlug), tx);
  for (const item of items) {
    const [product] = await tx
      .select({ stock: products.stock })
      .from(products)
      .where(eq(products.slug, item.productSlug))
      .for("update")
      .limit(1);
    const reserved =
      product && isCountedStock(product.stock, counted.has(item.productSlug)) ? Math.min(item.quantity, product.stock) : 0;
    await tx
      .update(products)
      .set({ stock: sql`${products.stock} - ${reserved}`, soldCount: sql`${products.soldCount} + ${item.quantity}` })
      .where(eq(products.slug, item.productSlug));
    await tx.update(orderItems).set({ stockReserved: reserved }).where(eq(orderItems.id, item.id));
  }
}

/**
 * Productos del pedido que no alcanzan para descontarlo de nuevo. El stock 1
 * del catálogo migrado es "hay", no una cantidad, así que no cuenta como falta.
 */
async function stockShortages(tx: Tx, orderId: number): Promise<string[]> {
  const rows = await tx
    .select({ name: orderItems.name, slug: orderItems.productSlug, quantity: orderItems.quantity, stock: products.stock })
    .from(orderItems)
    .innerJoin(products, eq(products.slug, orderItems.productSlug))
    .where(eq(orderItems.orderId, orderId));
  const counted = await countedStockSlugs(rows.map((r) => r.slug), tx);
  return rows
    .filter((row) => row.stock === 0 || (isCountedStock(row.stock, counted.has(row.slug)) && row.stock < row.quantity))
    .map((row) => row.name);
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
 * Después de guardar, avisa al cliente si el interruptor está prendido.
 */
export async function applyOrderStatus(
  orderId: number,
  input: { from: string; to: string; note?: string; extra?: Partial<typeof orders.$inferInsert> },
): Promise<boolean> {
  await Promise.all([ensureOrderStockSchema(), ensureCouponSchema(), ensureStockHoldSchema()]);
  const changed = input.from !== input.to;
  const applied = await db.transaction(async (tx) => {
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
    let note = input.note ?? "";
    // Una orden sin pago que ya devolvió el stock a las 2 hs: al cancelarla no
    // se devuelve otra vez, y al pagarla se vuelve a descontar.
    const released = changed
      ? (await tx.delete(orderStockHolds).where(eq(orderStockHolds.orderId, orderId)).returning({ id: orderStockHolds.orderId })).length > 0
      : false;
    if (changed && isCancelled(input.to)) {
      if (!released) await releaseOrderStock(tx, orderId);
      if (couponCode) await releaseCouponUse(tx, couponCode);
    }
    if (released && !isCancelled(input.to)) {
      const short = await stockShortages(tx, orderId);
      await reserveOrderStock(tx, orderId);
      if (short.length) {
        note = [note, `Ojo: el pago llegó después de liberar el stock y falta stock de ${short.join(", ")}.`].filter(Boolean).join(" ");
      }
    }
    if (changed && isCancelled(input.from)) {
      await reserveOrderStock(tx, orderId);
      if (couponCode) await restoreCouponUse(tx, couponCode);
    }
    if (changed || note) {
      await tx.insert(orderEvents).values({ orderId, fromStatus: input.from, toStatus: input.to, note });
    }
    return true;
  });
  // Fuera de la transacción: el email sale solo si el cambio quedó guardado, y
  // solo una vez aunque el webhook repita el aviso (el repetido no aplica).
  if (applied && changed) await notifyStatusChange(orderId, input.to, input.note);
  return applied;
}

/**
 * Cancela los pedidos que siguen en "Esperando el pago" pasadas las horas de
 * reserva y devuelve su stock. Corre desde el cron diario y al abrir el panel,
 * así no depende de que el cron esté activo. No hace nada si el interruptor
 * "Vencer pedidos sin pago" está apagado. Devuelve cuántos venció.
 */
export async function expireStalePendingOrders(): Promise<number> {
  await releaseStaleStockHolds();
  if (!(await isAutomationOn("vencerPedidos"))) return 0;
  await ensureUsdtSchema();
  const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000);
  const cutoff = hoursAgo(PENDING_EXPIRY_HOURS);
  const senaCutoff = hoursAgo(SENA_EXPIRY_HOURS);
  // De a tandas de 200 hasta que no quede ninguno: con un tope fijo, una ola
  // de pedidos falsos dejaría stock reservado por días. El máximo de tandas
  // corta el bucle si algún pedido no se pudiera cancelar.
  let expired = 0;
  for (let round = 0; round < 25; round += 1) {
    const stale = await db
      .select({ id: orders.id, paymentMethod: orders.paymentMethod })
      .from(orders)
      .where(
        and(
          eq(orders.status, "pendiente_pago"),
          sql`${orders.createdAt} < case when ${orders.paymentMethod} = 'sena' then ${senaCutoff.toISOString()}::timestamptz else ${cutoff.toISOString()}::timestamptz end`,
          // Un pago en USDT con TXID cargado no vence solo: lo decide César.
          sql`not exists (select 1 from usdt_payments where usdt_payments.order_id = ${orders.id} and usdt_payments.txid is not null)`,
        ),
      )
      .limit(200);
    for (const order of stale) {
      const applied = await applyOrderStatus(order.id, {
        from: "pendiente_pago",
        to: CANCELLED_STATUS.id,
        note: `Vencido: sin pago en ${pendingExpiryHours(order.paymentMethod)} hs.`,
      });
      if (applied) expired += 1;
    }
    if (stale.length < 200) break;
  }
  return expired + (await expireUnclaimedReservations());
}

/**
 * Cancela las reservas con seña acreditada que nadie retiró en `PICKUP_HOURS`
 * desde que se acreditó la seña, y devuelve el producto a la venta. La seña
 * no se devuelve sola: queda la nota en el pedido para resolverla con el
 * cliente. Lo llama `expireStalePendingOrders`, con el mismo interruptor.
 */
async function expireUnclaimedReservations(): Promise<number> {
  const cutoff = new Date(Date.now() - PICKUP_HOURS * 60 * 60 * 1000).toISOString();
  const stale = await db
    .select({ id: orders.id, status: orders.status })
    .from(orders)
    .where(
      and(
        eq(orders.paymentMethod, "sena"),
        inArray(orders.status, ["pago_confirmado", "preparando"]),
        // Cuándo se acreditó la seña: el último paso a "Pago acreditado".
        sql`(select max(e.created_at) from order_events e where e.order_id = ${orders.id} and e.to_status = 'pago_confirmado' and e.from_status <> e.to_status) < ${cutoff}::timestamptz`,
      ),
    )
    .limit(500);
  let expired = 0;
  for (const order of stale) {
    if (await applyOrderStatus(order.id, { from: order.status, to: CANCELLED_STATUS.id, note: UNCLAIMED_NOTE })) expired += 1;
  }
  return expired;
}

/**
 * Devuelve a la venta el stock de las órdenes que siguen sin pago pasadas
 * `STOCK_HOLD_HOURS`. La orden no se cancela: si el pago llega, `applyOrderStatus`
 * descuenta el stock de nuevo. Una orden en USDT con TXID cargado no se toca
 * (el pago ya salió y se está verificando). Corre al comprar, desde el cron y
 * al abrir el panel; no depende del interruptor de vencimiento. Devuelve cuántas liberó.
 */
export async function releaseStaleStockHolds(): Promise<number> {
  await Promise.all([ensureOrderStockSchema(), ensureStockHoldSchema(), ensureUsdtSchema()]);
  const cutoff = new Date(Date.now() - STOCK_HOLD_HOURS * 60 * 60 * 1000);
  let released = 0;
  for (let round = 0; round < 25; round += 1) {
    const stale = await db
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(
          eq(orders.status, "pendiente_pago"),
          lt(orders.createdAt, cutoff),
          sql`not exists (select 1 from order_stock_holds where order_stock_holds.order_id = ${orders.id})`,
          sql`not exists (select 1 from usdt_payments where usdt_payments.order_id = ${orders.id} and usdt_payments.txid is not null)`,
        ),
      )
      .limit(200);
    for (const order of stale) {
      const done = await db.transaction(async (tx) => {
        // La fila del pedido bloquea un cambio de estado simultáneo (un pago que llega justo).
        const [locked] = await tx
          .select({ status: orders.status })
          .from(orders)
          .where(eq(orders.id, order.id))
          .for("update");
        if (locked?.status !== "pendiente_pago") return false;
        const inserted = await tx.insert(orderStockHolds).values({ orderId: order.id }).onConflictDoNothing().returning({ id: orderStockHolds.orderId });
        if (!inserted.length) return false;
        await releaseOrderStock(tx, order.id);
        await tx.insert(orderEvents).values({
          orderId: order.id,
          fromStatus: "pendiente_pago",
          toStatus: "pendiente_pago",
          note: `Sin pago en ${STOCK_HOLD_HOURS} hs: el stock volvió a la venta. Si paga, se descuenta de nuevo.`,
        });
        return true;
      });
      if (done) released += 1;
    }
    if (stale.length < 200) break;
  }
  return released;
}

/**
 * Borra todos los pedidos (y con ellos los pagos, que salen de los pedidos).
 * Antes devuelve a la tienda el stock, las ventas y los usos de cupón que
 * descontaron los que no estaban cancelados, así el catálogo queda como si
 * nunca hubieran existido.
 */
export async function deleteAllOrders(): Promise<number> {
  await Promise.all([ensureOrderStockSchema(), ensureCouponSchema(), ensureStockHoldSchema()]);
  return db.transaction(async (tx) => {
    const holds = new Set((await tx.select({ id: orderStockHolds.orderId }).from(orderStockHolds)).map((row) => row.id));
    const all = await tx
      .select({ id: orders.id, status: orders.status, couponCode: orders.couponCode })
      .from(orders)
      .for("update");
    for (const order of all) {
      if (isCancelled(order.status)) continue;
      if (!holds.has(order.id)) await releaseOrderStock(tx, order.id);
      if (order.couponCode) await releaseCouponUse(tx, order.couponCode);
    }
    await tx.delete(orderStockHolds);
    await tx.delete(orderEvents);
    await tx.delete(orderItems);
    await tx.delete(orders);
    return all.length;
  });
}
