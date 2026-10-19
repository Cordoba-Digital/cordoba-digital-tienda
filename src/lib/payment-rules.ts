/**
 * Reglas de cobro de cada medio de pago: cuánto se paga online, cuánto dura
 * cada plazo y qué estados cuentan como pagado.
 *
 * No importa nada (ni la base ni otros módulos de la tienda), así lo pueden
 * usar el navegador, los emails y el servidor sin ciclos. Los textos para el
 * cliente leen los plazos de acá: si cambia un número, cambia en todos lados.
 */

/**
 * Horas que una orden sin pago le guarda el stock. Después el stock vuelve a la
 * venta (la orden sigue viva hasta vencer) y, si el pago llega, se descuenta de
 * nuevo. Así nadie puede dejar productos sin stock con órdenes que no paga.
 */
export const STOCK_HOLD_HOURS = 2;
/** Horas que una orden puede quedar sin pago antes de vencer (lo que promete la tienda). */
export const PENDING_EXPIRY_HOURS = 48;
/** La seña se espera menos: la reserva es para retirar en el local. */
export const SENA_EXPIRY_HOURS = 24;
/**
 * Con la seña acreditada, horas que el local guarda el producto para que lo
 * retiren y paguen el resto (Ronan, 19/10). Pasado ese plazo la reserva vence.
 */
export const PICKUP_HOURS = 48;

/**
 * Seña para retirar en el local: se paga por transferencia y confirma la
 * reserva; el resto se paga al retirar. Si el pedido cuesta menos, se paga el
 * total. Decisión de Ronan (19/10).
 */
export const SENA_PESOS = 10_000;

/** Horas que una orden de este medio puede quedar sin pago antes de vencer. */
export function pendingExpiryHours(paymentMethod: string): number {
  return paymentMethod === "sena" ? SENA_EXPIRY_HOURS : PENDING_EXPIRY_HOURS;
}

/** Lo que el cliente tiene que pagar online ahora: la seña o el total. */
export function amountDueOnline(order: { paymentMethod: string; total: number }): number {
  return order.paymentMethod === "sena" ? Math.min(SENA_PESOS, order.total) : order.total;
}

/** Lo que queda para pagar al retirar: el total menos lo cobrado online (0 si no es seña). */
export function amountDueAtPickup(order: { paymentMethod: string; total: number }): number {
  return order.total - amountDueOnline(order);
}

/**
 * Estados que cuentan como venta: la plata (o la seña) ya se acreditó. "Esperando
 * el pago" (`pendiente_pago`) y "Cancelado" quedan afuera porque la plata no entró.
 */
export const PAID_STATUSES = ["pago_confirmado", "preparando", "enviado", "entregado"] as const;

export function isPaidStatus(status: string): boolean {
  return (PAID_STATUSES as readonly string[]).includes(status);
}

/** Un pedido se cobró si llegó alguna vez a "Pago acreditado" o más allá, aunque después se cancele. */
export function wasEverPaid(status: string, eventStatuses: string[]): boolean {
  return [status, ...eventStatuses].some(isPaidStatus);
}
