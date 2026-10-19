import { getOrderByCode } from "@/lib/queries";
import { blockedMinutes, ipFromHeaders, ORDER_LOOKUP_LIMIT, recordMiss, tooManyAttempts } from "@/lib/rate-limit";
import { normalizeTxid } from "@/lib/tron";
import { submitUsdtTxid, syncUsdtPayment } from "@/lib/usdt-server";

export const dynamic = "force-dynamic";

/**
 * El cliente carga el TXID de su envío de USDT desde la página del pedido
 * (`{ txid }`). Se guarda, se busca en la red en el momento y, si ya aparece,
 * le llega el aviso a la tienda. El pedido pasa a pagado solo cuando César lo
 * aprueba en el panel.
 */
export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const ip = ipFromHeaders(request.headers);
  const blocked = await blockedMinutes(ORDER_LOOKUP_LIMIT, ip);
  if (blocked) return tooManyAttempts(blocked);

  const result = await getOrderByCode(decodeURIComponent(code));
  if (!result) {
    await recordMiss(ORDER_LOOKUP_LIMIT, ip);
    return Response.json({ ok: false, error: "No encontramos ese pedido." }, { status: 404 });
  }
  const { order } = result;
  if (order.paymentMethod !== "usdt") {
    return Response.json({ ok: false, error: "Este pedido no se paga con USDT." }, { status: 400 });
  }
  if (order.status !== "pendiente_pago") {
    return Response.json({ ok: false, error: "Este pedido ya no espera un pago." }, { status: 409 });
  }

  const body = (await request.json().catch(() => null)) as { txid?: unknown } | null;
  const txid = normalizeTxid(body?.txid);
  if (!txid) {
    return Response.json(
      { ok: false, error: "El TXID son 64 letras y números. Copialo entero desde tu wallet." },
      { status: 400 },
    );
  }

  const saved = await submitUsdtTxid(order, txid);
  if (!saved.ok) return Response.json({ ok: false, error: saved.error }, { status: saved.status });
  const payment = (await syncUsdtPayment(order)) ?? saved.payment;
  return Response.json({ ok: true, verified: !!payment.verifiedAt, amount: payment.transfer?.amount ?? null });
}
