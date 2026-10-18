/**
 * Ayudas puras para la pantalla de pedidos del panel (sin base de datos, así
 * las usan tanto las páginas del servidor como los componentes del navegador).
 */
import { ADMIN_ORDER_STATUSES, CANCELLED_STATUS, isCancelled, ORDER_STATUS_FLOW, statusIndex } from "@/lib/pricing";

/**
 * Link de WhatsApp a un celular argentino tal como lo escribe el cliente
 * ("351 612-4455", "0351 15 612-4455", "+54 9 11 4455-6677"). Devuelve null si
 * no parece un celular de Argentina, para no abrir un chat con otro número.
 */
export function whatsappHref(phone: string, text = ""): string | null {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("549")) digits = digits.slice(3);
  else if (digits.startsWith("54")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  // El "15" de los celulares va después de la característica (2 a 4 dígitos).
  if (digits.length === 12) {
    for (const areaLength of [2, 3, 4]) {
      if (digits.slice(areaLength, areaLength + 2) === "15") {
        digits = digits.slice(0, areaLength) + digits.slice(areaLength + 2);
        break;
      }
    }
  }
  if (digits.length !== 10) return null;
  return `https://wa.me/549${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** Mismas reglas que `canTransition` del servidor: avanzar, cancelar antes de que salga, reactivar un cancelado. */
export function allowedStatuses(from: string): { id: string; label: string }[] {
  return ADMIN_ORDER_STATUSES.filter((s) => {
    if (s.id === from || isCancelled(from)) return true;
    if (isCancelled(s.id)) return statusIndex(from) < statusIndex("enviado");
    return statusIndex(s.id) > statusIndex(from);
  }).map((s) => ({ id: s.id, label: s.label }));
}

export type NextStep = {
  /** Estado al que lleva el botón principal; null cuando no hay nada que hacer a mano. */
  to: string | null;
  button: string;
  hint: string;
  /** Pide el código de seguimiento antes de avanzar (envíos a domicilio). */
  asksTracking: boolean;
};

/** Qué tiene que hacer el local con el pedido ahora, en palabras. */
export function nextStep(order: { status: string; paymentMethod: string; deliveryMethod: string }): NextStep {
  const pickup = order.deliveryMethod === "pickup";
  switch (order.status) {
    case "pendiente_pago":
      if (order.paymentMethod === "mercadopago") {
        return {
          to: null,
          button: "",
          hint: "Esperando el pago en Mercado Pago. Cuando se acredita, el pedido pasa solo a Pago acreditado.",
          asksTracking: false,
        };
      }
      return {
        to: "pago_confirmado",
        button: "Marcar pago acreditado",
        hint:
          order.paymentMethod === "transferencia"
            ? "Cuando veas la transferencia en el banco, marcalo como pagado."
            : "Cuando el cliente pague, marcalo como pagado.",
        asksTracking: false,
      };
    case "pago_confirmado":
      return { to: "preparando", button: "Empezar a preparar", hint: "El pago está acreditado. Toca armar el pedido.", asksTracking: false };
    case "preparando":
      return pickup
        ? { to: "enviado", button: "Avisar que está listo para retirar", hint: "Cuando esté embalado, avisale al cliente que puede pasar a buscarlo.", asksTracking: false }
        : { to: "enviado", button: "Marcar como enviado", hint: "Cuando lo despaches, cargá el número de seguimiento.", asksTracking: true };
    case "enviado":
      return {
        to: "entregado",
        button: "Marcar como entregado",
        hint: pickup ? "Cuando el cliente lo retire, cerralo como entregado." : "Cuando el cliente lo reciba, cerralo como entregado.",
        asksTracking: false,
      };
    case CANCELLED_STATUS.id:
      return { to: null, button: "", hint: "Pedido cancelado: el stock y el cupón volvieron a la tienda.", asksTracking: false };
    default:
      return { to: null, button: "", hint: "Pedido terminado. No hay nada más para hacer.", asksTracking: false };
  }
}

/**
 * Pasos del flujo con su situación respecto del estado actual (para la línea
 * de progreso). "current" es el paso en curso; el último (entregado) ya no
 * está en curso: el pedido terminó y todos los pasos quedan hechos.
 */
export function statusSteps(status: string): { id: string; label: string; state: "done" | "current" | "todo" }[] {
  const current = statusIndex(status);
  const cancelled = isCancelled(status);
  const finished = current === ORDER_STATUS_FLOW.length - 1;
  return ORDER_STATUS_FLOW.map((s, i) => ({
    id: s.id,
    label: s.label,
    state: cancelled ? "todo" : i < current || finished ? "done" : i === current ? "current" : "todo",
  }));
}

/** Estados que piden algo del local (el número de la pestaña "Para atender"). */
export const ACTIONABLE_STATUSES = ["pendiente_pago", "pago_confirmado", "preparando"] as const;
