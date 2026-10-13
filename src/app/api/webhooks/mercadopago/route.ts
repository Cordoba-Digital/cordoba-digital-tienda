import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { after } from "next/server";

import { db } from "@/db";
import { orders } from "@/db/schema";
import { applyOrderStatus, canTransition } from "@/lib/order-status";
import { CANCELLED_STATUS, isCancelled } from "@/lib/pricing";

export const dynamic = "force-dynamic";

type MpNotification = {
  type?: string;
  topic?: string;
  data?: { id?: string | number };
};

function parseSignature(header: string): { ts?: string; v1?: string } {
  const parts = Object.fromEntries(
    header
      .split(",")
      .map((p) => p.split("=").map((s) => s.trim()))
      .filter((p) => p.length === 2),
  );
  return { ts: parts.ts, v1: parts.v1 };
}

/**
 * `dataId` es el id que cubrió la firma, no el del body: el body no está
 * firmado y alguien que reenvíe un aviso válido podría cambiarlo.
 */
async function handleEventAsync(notification: MpNotification, dataId: string): Promise<void> {
  const topic = notification.type ?? notification.topic;

  // Solo reconciliamos pagos; merchant_order legacy se registra sin actuar.
  if (topic !== "payment") {
    console.log(`[mp-webhook] tópico ignorado: ${topic} id=${dataId}`);
    return;
  }

  // Los ids de pago son numéricos; cualquier otra cosa no se manda a la API.
  if (!/^\d{1,20}$/.test(dataId)) {
    console.warn("[mp-webhook] id de pago con formato inesperado, ignorado.");
    return;
  }

  const token = process.env.MP_ACCESS_TOKEN?.trim();
  if (!token) {
    console.warn("[mp-webhook] sin MP_ACCESS_TOKEN, no se puede conciliar el pago.");
    return;
  }

  const res = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.warn(`[mp-webhook] GET payment ${dataId} -> ${res.status}`);
    return;
  }
  const payment = (await res.json()) as {
    id?: number;
    status?: string;
    external_reference?: string;
    transaction_amount?: number;
  };

  const ref = (payment.external_reference ?? "").trim().toUpperCase();
  if (!ref || payment.id == null) return;
  const paymentId = String(payment.id);

  const [order] = await db
    .select({ id: orders.id, status: orders.status, total: orders.total, paidWith: orders.mercadopagoPaymentId })
    .from(orders)
    .where(and(eq(orders.code, ref), eq(orders.paymentMethod, "mercadopago")))
    .limit(1);
  if (!order) {
    console.log(`[mp-webhook] payment ${paymentId} status=${payment.status} sin pedido MP ref=${ref}`);
    return;
  }

  if (payment.status === "approved") {
    // Solo se acredita si MP cobró exactamente el total del pedido. Si no
    // coincide, el pedido queda como está y el panel muestra la nota para que
    // alguien lo revise antes de despachar.
    const amount = typeof payment.transaction_amount === "number" ? Math.round(payment.transaction_amount) : null;
    if (amount !== order.total) {
      await applyOrderStatus(order.id, {
        from: order.status,
        to: order.status,
        note: `Pago ${paymentId} aprobado por $${amount ?? "?"}, pero el pedido es de $${order.total}. Revisar antes de despachar.`,
      });
      console.warn(`[mp-webhook] orden ${ref}: monto ${amount} != total ${order.total} (payment ${paymentId})`);
      return;
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
      if (applied) console.log(`[mp-webhook] orden ${ref} ${order.status} -> pago_confirmado (payment ${paymentId})`);
      return;
    }
    console.log(`[mp-webhook] payment ${paymentId} aprobado; orden ${ref} ya en ${order.status}`);
    return;
  }

  if (payment.status === "refunded" || payment.status === "charged_back") {
    // Solo cuenta si es el pago que acreditó este pedido.
    if (order.paidWith !== paymentId || isCancelled(order.status)) return;
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
    console.warn(`[mp-webhook] orden ${ref}: payment ${paymentId} ${payment.status}`);
    return;
  }

  console.log(`[mp-webhook] payment ${paymentId} status=${payment.status} ref=${ref}`);
}

/**
 * Webhook Mercado Pago — valida x-signature HMAC-SHA256 ANTES de procesar,
 * responde 200 INMEDIATO y procesa async. Idempotente por (type + data.id).
 */
export async function POST(request: Request) {
  const secret = process.env.MP_WEBHOOK_SECRET?.trim() ?? "";
  const signature = request.headers.get("x-signature") ?? "";
  const requestId = request.headers.get("x-request-id") ?? "";
  const notification = (await request.json().catch(() => ({}))) as MpNotification;

  // Sin secreto configurado no podemos validar: rechazar para no procesar ciego.
  if (!secret) {
    console.warn("[mp-webhook] MP_WEBHOOK_SECRET ausente — rechazo 500 para reintento posterior.");
    return new Response(null, { status: 500 });
  }

  const { ts, v1 } = parseSignature(signature);
  // Según la documentación de MP, el id firmado es el `data.id` de la URL (en
  // minúsculas si es alfanumérico); el del body queda como respaldo.
  const queryId = new URL(request.url).searchParams.get("data.id");
  const dataId = String(queryId ?? notification.data?.id ?? "").toLowerCase();
  if (!ts || !v1 || !dataId || !requestId) {
    return new Response(null, { status: 400 });
  }

  const canonical = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = crypto.createHmac("sha256", secret).update(canonical).digest("hex");
  const valid =
    expected.length === v1.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  if (!valid) {
    return new Response(null, { status: 401 });
  }

  // Sin chequeo de antigüedad del `ts`: MP reintenta el mismo aviso hasta un
  // día después, y repetir uno viejo no hace daño porque el estado siempre se
  // vuelve a leer de la API de MP con nuestro token.

  // 200 inmediato — MP reintenta con backoff hasta ~24h ante non-200.
  const response = new Response(null, { status: 200 });

  // Procesamiento async (dedup natural: mismo payment id sobrescribe mismo estado).
  // `after` mantiene viva la función en Vercel hasta que termina: con
  // `queueMicrotask` la instancia podía congelarse apenas salía el 200 y el
  // pedido quedaba en `pendiente_pago` aunque el cobro estuviera aprobado.
  after(() =>
    handleEventAsync(notification, dataId).catch((error) => console.error("[mp-webhook] handler:", error)),
  );

  return response;
}
