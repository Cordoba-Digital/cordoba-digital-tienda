import crypto from "node:crypto";
import { after } from "next/server";

import { reconcileMpPayment } from "@/lib/checkout-mp-sync";

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
  await reconcileMpPayment(dataId);
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
