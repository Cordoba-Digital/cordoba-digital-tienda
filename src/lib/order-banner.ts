/**
 * Aviso de arriba de la página del pedido, al terminar la compra.
 *
 * Un pedido se confirma con la plata acreditada, no antes: mientras espera el
 * pago no hay "gracias" ni "recibimos", sino lo que falta para confirmarlo, y
 * el aviso va en ámbar en vez de verde.
 */

/** Horas de reserva antes de que venza un pedido sin pago (`PENDING_EXPIRY_HOURS` en `lib/order-status`). */
const RESERVA_HS = 48;

export type OrderBanner = { tone: "pendiente" | "confirmado" | "cancelado"; title: string; detail: string | null };

export function orderBanner(order: { customerName: string; status: string; paymentMethod: string }): OrderBanner {
  // Cancelado no es confirmado: si se recarga la página de la compra (`?nuevo=1`)
  // después de cancelarlo, no puede volver a aparecer el "gracias".
  if (order.status === "cancelado") {
    return { tone: "cancelado", title: "Este pedido está cancelado", detail: null };
  }
  if (order.status !== "pendiente_pago") {
    const firstName = order.customerName.trim().split(/\s+/)[0] ?? "";
    const thanks = firstName ? `¡Gracias ${firstName}!` : "¡Gracias!";
    return { tone: "confirmado", title: `${thanks} Tu pedido está confirmado`, detail: null };
  }

  let detail: string | null = null;
  if (order.paymentMethod === "transferencia") {
    detail = `Transferí el total con los datos de abajo y mandanos el comprobante. Te reservamos el stock ${RESERVA_HS} hs: si el pago no se acredita, el pedido se cancela.`;
  } else if (order.paymentMethod === "usdt") {
    detail = `Enviá USDT por red TRON a la wallet de abajo y pegá el TXID. Te reservamos el stock ${RESERVA_HS} hs.`;
  } else if (order.paymentMethod === "mercadopago") {
    detail = "Completá el pago en Mercado Pago para confirmarlo.";
  } else if (order.paymentMethod === "efectivo") {
    detail = `Lo pagás en efectivo cuando lo retirás en el local. Te reservamos el stock ${RESERVA_HS} hs.`;
  }
  return { tone: "pendiente", title: "Falta el pago para confirmar tu pedido", detail };
}

/**
 * Cómo se llama el código mientras falta el pago: sin plata acreditada no hay
 * pedido confirmado, hay una reserva. El código es el mismo (sirve de
 * referencia para transferir y para seguirlo); cambia solo el nombre.
 */
export function orderCodeLabel(status: string): { label: string; noun: string } {
  return status === "pendiente_pago"
    ? { label: "Código de reserva", noun: "Reserva" }
    : { label: "Número de pedido", noun: "Pedido" };
}
