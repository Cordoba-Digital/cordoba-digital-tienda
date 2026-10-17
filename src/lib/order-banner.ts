/**
 * Aviso de arriba de la página del pedido, al terminar la compra.
 *
 * Un pedido se confirma con la plata acreditada, no antes: mientras espera el
 * pago no hay "gracias" ni "recibimos", sino lo que falta para confirmarlo, y
 * el aviso va en ámbar en vez de verde.
 */

/** Horas de reserva antes de que venza un pedido sin pago (`PENDING_EXPIRY_HOURS` en `lib/order-status`). */
const RESERVA_HS = 48;

export type OrderBanner = { tone: "pendiente" | "confirmado"; title: string; detail: string | null };

export function orderBanner(order: { customerName: string; status: string; paymentMethod: string }): OrderBanner {
  if (order.status !== "pendiente_pago") {
    const firstName = order.customerName.trim().split(/\s+/)[0] ?? "";
    const thanks = firstName ? `¡Gracias ${firstName}!` : "¡Gracias!";
    return { tone: "confirmado", title: `${thanks} Tu pedido está confirmado`, detail: null };
  }

  let detail: string | null = null;
  if (order.paymentMethod === "transferencia") {
    detail = `Transferí el total con los datos de abajo y mandanos el comprobante. Te reservamos el stock ${RESERVA_HS} hs: si el pago no se acredita, el pedido se cancela.`;
  } else if (order.paymentMethod === "mercadopago") {
    detail = "Completá el pago en Mercado Pago para confirmarlo.";
  } else if (order.paymentMethod === "efectivo") {
    detail = `Lo pagás en efectivo cuando lo retirás en el local. Te reservamos el stock ${RESERVA_HS} hs.`;
  }
  return { tone: "pendiente", title: "Falta el pago para confirmar tu pedido", detail };
}
