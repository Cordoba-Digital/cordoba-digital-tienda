/**
 * Texto del aviso verde que ve el cliente al terminar la compra.
 *
 * "Tu pedido está confirmado" se dice solo con el pago acreditado: un pedido
 * por transferencia sin pagar todavía puede vencer, así que ahí decimos que lo
 * recibimos y qué falta para confirmarlo.
 */

/** Horas de reserva antes de que venza un pedido sin pago (`PENDING_EXPIRY_HOURS` en `lib/order-status`). */
const RESERVA_HS = 48;

export function orderBanner(order: {
  customerName: string;
  status: string;
  paymentMethod: string;
}): { title: string; detail: string | null } {
  const firstName = order.customerName.trim().split(/\s+/)[0] ?? "";
  const thanks = firstName ? `¡Gracias ${firstName}!` : "¡Gracias!";
  if (order.status !== "pendiente_pago") return { title: `${thanks} Tu pedido está confirmado`, detail: null };

  let detail: string | null = null;
  if (order.paymentMethod === "transferencia") {
    detail = `Te reservamos el stock ${RESERVA_HS} hs. Transferí el total y mandanos el comprobante: cuando lo acreditemos te avisamos.`;
  } else if (order.paymentMethod === "mercadopago") {
    detail = "Completá el pago para confirmarlo.";
  } else if (order.paymentMethod === "efectivo") {
    detail = `Te reservamos el stock ${RESERVA_HS} hs. Lo pagás en efectivo cuando lo retirás en el local.`;
  }
  return { title: `${thanks} Recibimos tu pedido`, detail };
}
