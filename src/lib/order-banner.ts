/**
 * Aviso de arriba de la página del pedido, al terminar la compra.
 *
 * Un pedido se confirma con la plata acreditada, no antes: mientras espera el
 * pago no hay "gracias" ni "recibimos", sino lo que falta para confirmarlo, y
 * el aviso va en ámbar en vez de verde.
 */

import { money } from "@/lib/format";
import { amountDueOnline, SENA_EXPIRY_HOURS, STOCK_HOLD_HOURS } from "@/lib/payment-rules";

export type OrderBanner = { tone: "pendiente" | "confirmado" | "cancelado"; title: string; detail: string | null };

export function orderBanner(order: { customerName: string; status: string; paymentMethod: string; total: number }): OrderBanner {
  // Cancelado no es confirmado: si se recarga la página de la compra (`?nuevo=1`)
  // después de cancelarlo, no puede volver a aparecer el "gracias".
  if (order.status === "cancelado") {
    return { tone: "cancelado", title: "Este pedido está cancelado", detail: null };
  }
  if (order.status !== "pendiente_pago") {
    const firstName = order.customerName.trim().split(/\s+/)[0] ?? "";
    const thanks = firstName ? `¡Gracias ${firstName}!` : "¡Gracias!";
    if (order.paymentMethod === "sena") {
      return { tone: "confirmado", title: `${thanks} Tu reserva está confirmada`, detail: null };
    }
    return { tone: "confirmado", title: `${thanks} Tu pedido está confirmado`, detail: null };
  }

  let detail: string | null = null;
  if (order.paymentMethod === "transferencia") {
    detail = `Transferí el total con los datos de abajo y mandanos el comprobante. Te guardamos el stock ${STOCK_HOLD_HOURS} hs.`;
  } else if (order.paymentMethod === "sena") {
    detail = `Transferí la seña de ${money(amountDueOnline(order))} para confirmar la reserva. Si no llega en ${SENA_EXPIRY_HOURS} hs, la orden se cancela.`;
  } else if (order.paymentMethod === "usdt") {
    detail = `Enviá USDT por red TRON a la wallet de abajo y pegá el TXID. Te reservamos el stock ${STOCK_HOLD_HOURS} hs.`;
  } else if (order.paymentMethod === "mercadopago") {
    detail = "Completá el pago en Mercado Pago para confirmarlo.";
  } else if (order.paymentMethod === "efectivo") {
    detail = "Lo pagás en efectivo cuando lo retirás en el local.";
  }
  return {
    tone: "pendiente",
    title: order.paymentMethod === "sena" ? "Falta la seña para confirmar tu reserva" : "Falta el pago para confirmar tu pedido",
    detail,
  };
}

/**
 * Cómo se llama el código. Sin plata acreditada no hay reserva ni pedido: es
 * una orden de pago, y el número sirve de referencia para transferir. Con la
 * seña acreditada pasa a ser el código de reserva (Ronan, 19/10); con el pago
 * completo, el número de pedido. El código es siempre el mismo.
 */
export function orderCodeLabel(status: string, paymentMethod = ""): { label: string; noun: string } {
  if (status === "pendiente_pago") return { label: "Número de orden", noun: "Orden" };
  if (paymentMethod === "sena" && status !== "cancelado") return { label: "Código de reserva", noun: "Reserva" };
  return { label: "Número de pedido", noun: "Pedido" };
}
