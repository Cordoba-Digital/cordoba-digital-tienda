import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { orderEvents, orderItems, orderReturns, orders, products, type ReturnItem } from "@/db/schema";
import { ensureOrderStockSchema } from "@/lib/order-status";

/**
 * Productos que vuelven al local de un pedido que ya salió (arrepentimiento,
 * falla, cambio). Se anota cuando el producto llega: las unidades vuelven al
 * stock y queda una nota en el historial. El pedido no cambia de estado y la
 * plata se devuelve aparte, desde Reembolsos.
 */

export type ReturnRow = typeof orderReturns.$inferSelect;

/** Solo se recibe lo que salió del local. */
const RETURNABLE = ["enviado", "entregado"];

export async function listOrderReturns(orderId: number): Promise<ReturnRow[]> {
  return db.select().from(orderReturns).where(eq(orderReturns.orderId, orderId)).orderBy(desc(orderReturns.createdAt));
}

/** Unidades devueltas hasta ahora, por ítem del pedido. */
export function returnedByItem(rows: Pick<ReturnRow, "items">[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const row of rows) {
    for (const item of row.items) out.set(item.orderItemId, (out.get(item.orderItemId) ?? 0) + item.quantity);
  }
  return out;
}

export type ReturnResult = { ok: true; return: ReturnRow } | { ok: false; status: number; error: string };

export async function registerReturn(
  code: string,
  input: { items: { orderItemId: number; quantity: number }[]; reason: string; actor: string },
): Promise<ReturnResult> {
  const reason = input.reason.trim().slice(0, 300);
  if (!reason) return { ok: false, status: 400, error: "Contá por qué lo devolvió (queda en el historial)." };
  const wanted = new Map<number, number>();
  for (const item of input.items) {
    const quantity = Math.floor(Number(item.quantity));
    if (!Number.isInteger(item.orderItemId) || !Number.isFinite(quantity) || quantity < 0) {
      return { ok: false, status: 400, error: "Las cantidades tienen que ser números enteros." };
    }
    if (quantity > 0) wanted.set(item.orderItemId, (wanted.get(item.orderItemId) ?? 0) + quantity);
  }
  if (!wanted.size) return { ok: false, status: 400, error: "Elegí al menos un producto devuelto." };

  await ensureOrderStockSchema();
  return db.transaction(async (tx) => {
    // Con el pedido bloqueado, dos devoluciones a la vez se ordenan y la
    // segunda ve las unidades que anotó la primera.
    const [order] = await tx
      .select({ id: orders.id, status: orders.status })
      .from(orders)
      .where(eq(orders.code, code.trim().toUpperCase()))
      .for("update")
      .limit(1);
    if (!order) return { ok: false as const, status: 404, error: "No encontramos un pedido con ese código." };
    if (!RETURNABLE.includes(order.status)) {
      return {
        ok: false as const,
        status: 409,
        error: "Solo se reciben devoluciones de pedidos enviados o entregados. Si el pedido no salió, cancelalo y el stock vuelve solo.",
      };
    }

    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    const previous = returnedByItem(await tx.select({ items: orderReturns.items }).from(orderReturns).where(eq(orderReturns.orderId, order.id)));
    const returned: ReturnItem[] = [];
    for (const [orderItemId, quantity] of wanted) {
      const item = items.find((i) => i.id === orderItemId);
      if (!item) return { ok: false as const, status: 400, error: "Ese producto no es de este pedido." };
      const left = item.quantity - (previous.get(item.id) ?? 0);
      if (quantity > left) {
        return {
          ok: false as const,
          status: 400,
          error: left > 0 ? `De ${item.name} se pueden devolver hasta ${left}.` : `${item.name} ya se devolvió completo.`,
        };
      }
      returned.push({ orderItemId: item.id, productSlug: item.productSlug, name: item.name, quantity });

      // Si la compra descontó stock real, vuelven las unidades. Si el stock era
      // solo disponibilidad (1/0), el producto vuelve a figurar disponible.
      await tx
        .update(products)
        .set({
          stock: item.stockReserved > 0 ? sql`${products.stock} + ${quantity}` : sql`greatest(${products.stock}, 1)`,
          soldCount: sql`greatest(${products.soldCount} - ${quantity}, 0)`,
        })
        .where(eq(products.slug, item.productSlug));
      if (item.stockReserved > 0) {
        await tx
          .update(orderItems)
          .set({ stockReserved: Math.max(item.stockReserved - quantity, 0) })
          .where(eq(orderItems.id, item.id));
      }
    }

    const [row] = await tx
      .insert(orderReturns)
      .values({ orderId: order.id, items: returned, reason, createdBy: input.actor })
      .returning();
    const list = returned.map((r) => `${r.quantity} × ${r.name}`).join(", ");
    await tx.insert(orderEvents).values({
      orderId: order.id,
      fromStatus: order.status,
      toStatus: order.status,
      note: `Devolución recibida: ${list}. Motivo: ${reason}. El stock volvió a la tienda.`,
    });
    return { ok: true as const, return: row };
  });
}
