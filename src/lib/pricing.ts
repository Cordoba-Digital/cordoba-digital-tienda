/**
 * Medios de pago. Los tres primeros son exactamente los que ofrece el sitio
 * original, leídos del checkout real (no inventados):
 *
 *   - `bacs`                 → "Pago por transferencia bancaria"
 *   - `cod`                  → "Pago en efectivo o transferencia en el local"
 *   - `cd_usdt_trc20_manual` → "USDT (TRC20) - Transferencia"
 *
 * Mercado Pago se suma como cuarta opción: es la integración que estamos
 * construyendo y cubre tarjeta de crédito, débito y dinero en cuenta, que es
 * justamente lo que el original no tiene online.
 */
export type PaymentMethodId = "transferencia" | "usdt" | "efectivo" | "mercadopago";

/**
 * Tope de unidades por producto en un pedido: 10. Vale para la ficha, el
 * carrito y el checkout, que lo leen de acá para no repetir el número.
 * No sale del sitio original (que no publica tope): es una decisión del
 * negocio para evitar pedidos mayoristas por el canal minorista.
 */
export const MAX_QTY_PER_ITEM = 10;

export type PaymentMethod = {
  id: PaymentMethodId;
  label: string;
  short: string;
  description: string;
  icon: string;
  perk?: string;
};

export const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: "transferencia",
    label: "Pago por transferencia bancaria",
    short: "Transferencia bancaria",
    description: "Te enviamos el CBU o el alias al confirmar. Acreditación inmediata.",
    icon: "🏦",
  },
  {
    id: "usdt",
    label: "USDT (TRC20) - Transferencia",
    short: "USDT (TRC20)",
    description: "Pagá con USDT por red TRC20. El pedido se procesa una vez confirmado el pago.",
    icon: "🪙",
  },
  {
    id: "efectivo",
    label: "Pago en efectivo o transferencia en el local",
    short: "Efectivo en el local",
    description: "Reservás online y pagás al retirar en 27 de Abril 180.",
    icon: "💵",
  },
  {
    id: "mercadopago",
    label: "Mercado Pago",
    short: "Mercado Pago",
    description: "Tarjeta de crédito, débito o dinero en cuenta.",
    icon: "💠",
  },
];

export type CouponInfo = {
  code: string;
  kind: string;
  value: number;
  minSubtotal: number;
  description: string;
};

export function couponDiscountFor(subtotal: number, coupon: CouponInfo | null): number {
  if (!coupon) return 0;
  if (subtotal < coupon.minSubtotal) return 0;
  if (coupon.kind === "percent") return Math.round((subtotal * coupon.value) / 100);
  return Math.min(coupon.value, subtotal);
}

export type Totals = {
  subtotal: number;
  couponDiscount: number;
  paymentAdjustment: number;
  shippingCost: number;
  total: number;
  installmentAmount: number;
  savings: number;
};

export function computeTotals(input: {
  subtotal: number;
  listSubtotal?: number;
  coupon: CouponInfo | null;
  shippingCost: number;
  paymentMethod: PaymentMethodId;
  installments: number;
}): Totals {
  const { subtotal, coupon, shippingCost, paymentMethod, installments } = input;
  const couponDiscount = couponDiscountFor(subtotal, coupon);
  const afterCoupon = Math.max(0, subtotal - couponDiscount);

  // Ningún medio de pago cambia el total. El checkout del sitio original muestra
  // subtotal = total, sin descuento por transferencia ni por efectivo: el que
  // quiera el precio del listado, paga el precio del listado.
  //
  // Tampoco cambia según cuántas cuotas se elijan. Antes sí: multiplicaba el
  // total por un coeficiente fijo (1,12 para 9 cuotas y 1,22 para 12) y lo
  // mostraba como "Interés de financiación". Ese interés no salía de ningún
  // cálculo, era un número puesto a mano, y además contradecía el comentario de
  // arriba. Si algún día hay cuotas con interés real, el número tiene que venir
  // de la cuenta de Mercado Pago, no de una tabla del código.
  const paymentAdjustment = 0;
  const total = afterCoupon + shippingCost;

  // El monto por cuota es solo informativo: el total ya está cerrado y no
  // depende de cuántas veces se pague.
  const installmentAmount = installments > 1 ? Math.round(total / installments) : total;

  const listSubtotal = input.listSubtotal ?? subtotal;

  return {
    subtotal,
    couponDiscount,
    paymentAdjustment,
    shippingCost,
    total,
    installmentAmount,
    savings: Math.max(0, listSubtotal - subtotal) + couponDiscount,
  };
}

export const ORDER_STATUS_FLOW = [
  { id: "pendiente_pago", label: "Pedido recibido", description: "Reservamos tu stock por 48 hs." },
  { id: "pago_confirmado", label: "Pago acreditado", description: "Verificamos el pago y emitimos la factura." },
  { id: "preparando", label: "Preparando el pedido", description: "Controlamos y embalamos tu producto." },
  { id: "enviado", label: "En camino / Listo para retirar", description: "Te enviamos el código de seguimiento." },
  { id: "entregado", label: "Entregado", description: "¡Disfrutalo! La garantía ya está activa." },
] as const;

export function statusIndex(status: string): number {
  const index = ORDER_STATUS_FLOW.findIndex((s) => s.id === status);
  return index === -1 ? 0 : index;
}

export function statusLabel(status: string): string {
  return ORDER_STATUS_FLOW.find((s) => s.id === status)?.label ?? "Pedido recibido";
}
