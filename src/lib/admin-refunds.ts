import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { orderEvents, orderRefunds, orders } from "@/db/schema";
import { money } from "@/lib/format";
import { applyOrderStatus, canTransition } from "@/lib/order-status";
import { CANCELLED_STATUS, isCancelled, statusIndex } from "@/lib/pricing";

/**
 * Devolver plata de un pedido desde el panel, total o parcial.
 *
 * Con Mercado Pago el reembolso se pide a la API de MP sobre el pago que
 * acreditó el pedido; con cualquier otro medio el local devuelve por fuera y
 * lo anota. En los dos casos queda una fila en `order_refunds` y una nota en
 * el historial. Si se devolvió todo y el pedido no salió, se cancela (el stock
 * y el cupón vuelven); si ya salió, solo queda la nota.
 */

export type RefundRow = typeof orderRefunds.$inferSelect;

/** Lo que cuenta como devuelto: lo hecho y lo que MP todavía está procesando. */
const COUNTED = ["pendiente", "hecho"];

/** Un pedido se cobró si llegó alguna vez a "Pago acreditado" o más allá. */
export function orderWasPaid(status: string, eventStatuses: string[]): boolean {
  const paid = statusIndex("pago_confirmado");
  return [status, ...eventStatuses].some((s) => !isCancelled(s) && statusIndex(s) >= paid);
}

export async function listOrderRefunds(orderId: number): Promise<RefundRow[]> {
  return db.select().from(orderRefunds).where(eq(orderRefunds.orderId, orderId)).orderBy(desc(orderRefunds.createdAt));
}

/** Total devuelto (o en curso) de un pedido. */
export function refundedTotal(rows: Pick<RefundRow, "amount" | "estado">[]): number {
  return rows.filter((r) => COUNTED.includes(r.estado)).reduce((sum, r) => sum + r.amount, 0);
}

export type RefundResult =
  | { ok: true; refund: RefundRow; cancelled: boolean; refunded: number }
  | { ok: false; status: number; error: string };

type MpRefund = { id?: number | string; amount?: number; status?: string };

function mpToken(): string | null {
  return process.env.MP_ACCESS_TOKEN?.trim() || null;
}

/**
 * Pide el reembolso a MP. La clave de idempotencia es la fila nuestra: si el
 * mismo pedido se repite (reintento tras un corte), MP devuelve el mismo
 * reembolso en vez de hacer otro.
 */
async function requestMpRefund(paymentId: string, amount: number, refundId: number, token: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}/refunds`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": `cd-reembolso-${refundId}`,
    },
    body: JSON.stringify({ amount }),
  }).catch(() => null);
  if (!res) return { ok: false, error: "Mercado Pago no respondió." };
  const json = (await res.json().catch(() => ({}))) as MpRefund & { message?: string };
  if (!res.ok || json.id == null) {
    console.warn(`[mp] reembolso de ${paymentId} -> ${res.status} ${json.message ?? ""}`);
    return { ok: false, error: `Mercado Pago rechazó el reembolso (${res.status}${json.message ? `: ${json.message}` : ""}).` };
  }
  return { ok: true, id: String(json.id) };
}

export async function refundOrder(
  code: string,
  input: { amount: number; reason: string; actor: string },
): Promise<RefundResult> {
  const amount = Math.floor(Number(input.amount));
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, status: 400, error: "El monto tiene que ser mayor a cero." };
  const reason = input.reason.trim().slice(0, 300);
  if (!reason) return { ok: false, status: 400, error: "Contá por qué se devuelve (queda en el historial)." };

  // Reserva: con el pedido bloqueado se calcula cuánto queda por devolver y se
  // anota el reembolso como pendiente. Dos pedidos de reembolso a la vez se
  // ordenan acá y el segundo ve lo que anotó el primero.
  const reserved = await db.transaction(async (tx) => {
    const [order] = await tx
      .select({
        id: orders.id,
        status: orders.status,
        total: orders.total,
        paymentMethod: orders.paymentMethod,
        mpPaymentId: orders.mercadopagoPaymentId,
      })
      .from(orders)
      .where(eq(orders.code, code.trim().toUpperCase()))
      .for("update")
      .limit(1);
    if (!order) return { ok: false as const, status: 404, error: "No encontramos un pedido con ese código." };

    const events = await tx.select({ toStatus: orderEvents.toStatus }).from(orderEvents).where(eq(orderEvents.orderId, order.id));
    if (!orderWasPaid(order.status, events.map((e) => e.toStatus))) {
      return { ok: false as const, status: 409, error: "El pedido no tiene un pago acreditado para devolver." };
    }
    const viaMp = order.paymentMethod === "mercadopago";
    if (viaMp && !order.mpPaymentId) {
      return { ok: false as const, status: 409, error: "No tenemos el número de pago de Mercado Pago de este pedido. Devolvelo desde Mercado Pago." };
    }

    const [{ refunded }] = await tx
      .select({ refunded: sql<number>`coalesce(sum(${orderRefunds.amount}), 0)::int` })
      .from(orderRefunds)
      .where(and(eq(orderRefunds.orderId, order.id), inArray(orderRefunds.estado, COUNTED)));
    const available = order.total - refunded;
    if (available <= 0) return { ok: false as const, status: 409, error: "Este pedido ya se devolvió completo." };
    if (amount > available) {
      return { ok: false as const, status: 400, error: `Se pueden devolver hasta ${money(available)}.` };
    }

    const [row] = await tx
      .insert(orderRefunds)
      .values({
        orderId: order.id,
        amount,
        method: viaMp ? "mercadopago" : "manual",
        estado: viaMp ? "pendiente" : "hecho",
        reason,
        createdBy: input.actor,
      })
      .returning();
    return { ok: true as const, order, row, refundedAfter: refunded + amount };
  });
  if (!reserved.ok) return reserved;
  const { order, refundedAfter } = reserved;
  let row = reserved.row;

  if (row.method === "mercadopago") {
    const token = mpToken();
    const result = token
      ? await requestMpRefund(order.mpPaymentId!, amount, row.id, token)
      : ({ ok: false, error: "Mercado Pago no está conectado." } as const);
    [row] = await db
      .update(orderRefunds)
      .set(result.ok ? { estado: "hecho", externalId: result.id } : { estado: "fallido", error: result.error })
      .where(eq(orderRefunds.id, row.id))
      .returning();
    if (!result.ok) return { ok: false, status: 502, error: result.error };
  }

  const how = row.method === "mercadopago" ? "por Mercado Pago" : "por fuera de la tienda";
  const note = `Reembolso de ${money(amount)} ${how}: ${reason}`;
  const full = refundedAfter >= order.total;
  // Todo devuelto y el pedido sin salir: se cancela y vuelven stock y cupón.
  // Leemos el estado de nuevo porque el webhook de MP pudo cancelarlo recién.
  const [current] = await db.select({ status: orders.status }).from(orders).where(eq(orders.id, order.id)).limit(1);
  const cancel = full && !isCancelled(current.status) && !canTransition(current.status, CANCELLED_STATUS.id);
  const applied = await applyOrderStatus(order.id, {
    from: current.status,
    to: cancel ? CANCELLED_STATUS.id : current.status,
    note: cancel ? `${note}. Pedido cancelado: se devolvió el total.` : note,
  });
  // Si el estado cambió en el medio (otro aviso llegó antes), la nota igual queda.
  if (!applied) {
    await db.insert(orderEvents).values({ orderId: order.id, fromStatus: current.status, toStatus: current.status, note });
  }
  return { ok: true, refund: row, cancelled: cancel && applied, refunded: refundedAfter };
}

/**
 * Anota los reembolsos que MP informa en un pago (hechos desde la cuenta de MP
 * y no desde el panel). Los que ya están, por su id de MP, se saltean.
 */
export async function syncMpRefunds(orderId: number, refunds: MpRefund[]): Promise<number> {
  let added = 0;
  for (const refund of refunds) {
    if (refund.id == null || typeof refund.amount !== "number" || refund.status === "rejected") continue;
    // Uno pedido desde el panel que todavía espera la respuesta de MP: lo
    // completa el panel con este mismo id, no se duplica acá.
    const [waiting] = await db
      .select({ id: orderRefunds.id })
      .from(orderRefunds)
      .where(and(eq(orderRefunds.orderId, orderId), eq(orderRefunds.estado, "pendiente"), eq(orderRefunds.amount, Math.round(refund.amount))))
      .limit(1);
    if (waiting) continue;
    const rows = await db
      .insert(orderRefunds)
      .values({
        orderId,
        amount: Math.round(refund.amount),
        method: "mercadopago",
        estado: "hecho",
        reason: "Hecho desde la cuenta de Mercado Pago",
        externalId: String(refund.id),
        createdBy: "mercadopago",
      })
      .onConflictDoNothing({ target: orderRefunds.externalId })
      .returning({ id: orderRefunds.id });
    added += rows.length;
  }
  return added;
}
