import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { orderEvents, orders } from "@/db/schema";
import { syncMpRefunds } from "@/lib/admin-refunds";
import { applyOrderStatus, canTransition } from "@/lib/order-status";
import { CANCELLED_STATUS, isCancelled } from "@/lib/pricing";

/**
 * Concilia pedidos de Mercado Pago contra la API de MP. Lo usan tres caminos
 * que terminan en el mismo lugar:
 *
 * - el webhook (`api/webhooks/mercadopago`), que es el principal;
 * - la página del pedido cuando el cliente vuelve de MP con `payment_id`, por
 *   si el aviso todavía no llegó o no llega nunca;
 * - el cron diario, que repasa los pedidos de MP que siguen pendientes.
 *
 * El estado siempre se lee de la API con nuestro token: nada de lo que llega
 * en la URL o en el aviso se usa como dato del pago.
 */

type MpPayment = {
  id?: number;
  status?: string;
  external_reference?: string;
  transaction_amount?: number;
  /** Reembolsos del pago, totales o parciales (hechos desde el panel o desde MP). */
  refunds?: { id?: number | string; amount?: number; status?: string }[];
};

export type ReconcileResult =
  | "acreditado"
  | "ya_acreditado"
  | "monto_distinto"
  | "cancelado_por_devolucion"
  | "nota_devolucion"
  | "sin_cambios"
  | "sin_pedido"
  | "no_disponible";

const PAYMENT_ID = /^\d{1,20}$/;

function mpToken(): string | null {
  return process.env.MP_ACCESS_TOKEN?.trim() || null;
}

async function fetchPayment(paymentId: string, token: string): Promise<MpPayment | null> {
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.warn(`[mp] GET payment ${paymentId} -> ${res.status}`);
    return null;
  }
  return (await res.json()) as MpPayment;
}

/**
 * Trae el pago `paymentId` de MP y aplica su estado al pedido de MP con ese
 * `external_reference`. Con `expectedCode`, solo actúa si el pago es de ese
 * pedido (la página del pedido no puede acreditar otro pedido con un id ajeno).
 */
export async function reconcileMpPayment(
  rawPaymentId: string,
  { expectedCode }: { expectedCode?: string } = {},
): Promise<ReconcileResult> {
  // Los ids de pago son numéricos; cualquier otra cosa no se manda a la API.
  if (!PAYMENT_ID.test(rawPaymentId)) return "no_disponible";
  const token = mpToken();
  if (!token) {
    console.warn("[mp] sin MP_ACCESS_TOKEN, no se puede conciliar el pago.");
    return "no_disponible";
  }
  const payment = await fetchPayment(rawPaymentId, token);
  if (!payment) return "no_disponible";

  const ref = (payment.external_reference ?? "").trim().toUpperCase();
  if (!ref || payment.id == null) return "sin_pedido";
  if (expectedCode && ref !== expectedCode.trim().toUpperCase()) return "sin_pedido";
  const paymentId = String(payment.id);

  const [order] = await db
    .select({ id: orders.id, status: orders.status, total: orders.total, paidWith: orders.mercadopagoPaymentId })
    .from(orders)
    .where(and(eq(orders.code, ref), eq(orders.paymentMethod, "mercadopago")))
    .limit(1);
  if (!order) {
    console.log(`[mp] payment ${paymentId} status=${payment.status} sin pedido MP ref=${ref}`);
    return "sin_pedido";
  }

  // Los reembolsos del pago que acreditó el pedido quedan anotados aunque se
  // hayan hecho desde la cuenta de MP y no desde el panel.
  if (order.paidWith === paymentId && payment.refunds?.length) {
    await syncMpRefunds(order.id, payment.refunds);
  }

  if (payment.status === "approved") {
    // Solo se acredita si MP cobró exactamente el total del pedido. Si no
    // coincide, el pedido queda como está y el panel muestra la nota para que
    // alguien lo revise antes de despachar.
    const amount = typeof payment.transaction_amount === "number" ? Math.round(payment.transaction_amount) : null;
    if (amount !== order.total) {
      const note = `Pago ${paymentId} aprobado por $${amount ?? "?"}, pero el pedido es de $${order.total}. Revisar antes de despachar.`;
      // La misma nota no se repite cada vez que el cliente recarga la página.
      const repeated = await lastNoteIs(order.id, note);
      if (!repeated) await applyOrderStatus(order.id, { from: order.status, to: order.status, note });
      console.warn(`[mp] orden ${ref}: monto ${amount} != total ${order.total} (payment ${paymentId})`);
      return "monto_distinto";
    }

    // Un pendiente pasa a pagado; uno vencido se reactiva y vuelve a reservar
    // el stock, en vez de perder el cobro. Un cobro nunca hace retroceder un
    // pedido que ya avanzó.
    if (order.status === "pendiente_pago" || isCancelled(order.status)) {
      const applied = await applyOrderStatus(order.id, {
        from: order.status,
        to: "pago_confirmado",
        note: isCancelled(order.status)
          ? `Pago de Mercado Pago acreditado después de cancelado (payment ${paymentId}).`
          : `Pago de Mercado Pago acreditado (payment ${paymentId}).`,
        extra: { mercadopagoPaymentId: paymentId },
      });
      if (applied) {
        console.log(`[mp] orden ${ref} ${order.status} -> pago_confirmado (payment ${paymentId})`);
        return "acreditado";
      }
    }
    return "ya_acreditado";
  }

  if (payment.status === "refunded" || payment.status === "charged_back") {
    // Solo cuenta si es el pago que acreditó este pedido.
    if (order.paidWith !== paymentId || isCancelled(order.status)) return "sin_cambios";
    const what = payment.status === "refunded" ? "devuelto" : "desconocido por el titular (contracargo)";
    const blocked = canTransition(order.status, CANCELLED_STATUS.id);
    await applyOrderStatus(order.id, {
      from: order.status,
      // Si el pedido todavía no salió, se cancela y el stock vuelve a la tienda.
      // Si ya salió, no se puede cancelar: queda la nota para el admin.
      to: blocked ? order.status : CANCELLED_STATUS.id,
      note: blocked
        ? `El pago ${paymentId} fue ${what} en Mercado Pago, pero el pedido ya salió. Revisar.`
        : `Cancelado: el pago ${paymentId} fue ${what} en Mercado Pago.`,
    });
    console.warn(`[mp] orden ${ref}: payment ${paymentId} ${payment.status}`);
    return blocked ? "nota_devolucion" : "cancelado_por_devolucion";
  }

  console.log(`[mp] payment ${paymentId} status=${payment.status} ref=${ref}`);
  return "sin_cambios";
}

async function lastNoteIs(orderId: number, note: string): Promise<boolean> {
  const [last] = await db
    .select({ note: orderEvents.note })
    .from(orderEvents)
    .where(eq(orderEvents.orderId, orderId))
    .orderBy(desc(orderEvents.id))
    .limit(1);
  return last?.note === note;
}

/**
 * Repasa los pedidos de MP que siguen pendientes y busca en MP si alguno tiene
 * un pago aprobado que no llegó por el webhook. Lo corre el cron diario antes
 * de vencer pedidos, para no cancelar uno que ya se cobró.
 */
export async function syncPendingMpOrders(): Promise<{ revisados: number; acreditados: number }> {
  const token = mpToken();
  if (!token) return { revisados: 0, acreditados: 0 };
  const pending = await db
    .select({ code: orders.code })
    .from(orders)
    .where(and(eq(orders.paymentMethod, "mercadopago"), eq(orders.status, "pendiente_pago")))
    .limit(100);

  let acreditados = 0;
  for (const { code } of pending) {
    const url = new URL("https://api.mercadopago.com/v1/payments/search");
    url.searchParams.set("external_reference", code);
    url.searchParams.set("status", "approved");
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
    if (!res?.ok) {
      console.warn(`[mp] búsqueda de pagos de ${code} -> ${res?.status ?? "sin respuesta"}`);
      continue;
    }
    const { results = [] } = (await res.json()) as { results?: MpPayment[] };
    for (const payment of results) {
      if (payment.id == null) continue;
      if ((await reconcileMpPayment(String(payment.id), { expectedCode: code })) === "acreditado") {
        acreditados += 1;
        break;
      }
    }
  }
  return { revisados: pending.length, acreditados };
}
