import crypto from "node:crypto";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { orders } from "@/db/schema";

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

async function handleEventAsync(notification: MpNotification): Promise<void> {
  const topic = notification.type ?? notification.topic;
  const dataId = notification.data?.id;
  if (!dataId) return;

  // Solo reconciliamos pagos; merchant_order legacy se registra sin actuar.
  if (topic !== "payment") {
    console.log(`[mp-webhook] tópico ignorado: ${topic} id=${dataId}`);
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
  };

  const ref = (payment.external_reference ?? "").trim().toUpperCase();
  if (!ref || payment.id == null) return;

  if (payment.status === "approved") {
    await db
      .update(orders)
      .set({ status: "pago_confirmado", mercadopagoPaymentId: String(payment.id) })
      .where(eq(orders.code, ref));
    console.log(`[mp-webhook] orden ${ref} -> pago_confirmado (payment ${payment.id})`);
  } else {
    console.log(`[mp-webhook] payment ${payment.id} status=${payment.status} ref=${ref}`);
  }
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
  const dataId = notification.data?.id;
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

  // 200 inmediato — MP reintenta con backoff hasta ~24h ante non-200.
  const response = new Response(null, { status: 200 });

  // Procesamiento async (dedup natural: mismo payment id sobrescribe mismo estado).
  queueMicrotask(() => {
    handleEventAsync(notification).catch((error) => console.error("[mp-webhook] handler:", error));
  });

  return response;
}
