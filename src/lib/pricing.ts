import { INSTALLMENT_PLANS, TRANSFER_DISCOUNT } from "@/lib/format";

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
    perk: "15% OFF",
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
    description: "Reservás online y pagás al retirar en 27 de Abril 259.",
    icon: "💵",
    perk: "15% OFF",
  },
  {
    id: "mercadopago",
    label: "Mercado Pago",
    short: "Mercado Pago",
    description: "Tarjeta de crédito, débito o dinero en cuenta. Hasta 6 cuotas sin interés.",
    icon: "💠",
  },
];

/**
 * Métodos que llevan el descuento del 15%.
 *
 * OJO: ese 15% NO existe en el sitio original. Al leer su checkout, el total da
 * exactamente igual al subtotal, sin línea de descuento. Está agrupado acá para
 * que sea un solo lugar que tocar si el cliente no lo quiere. Ver
 * `docs/PLAN-CERRADO.md`.
 */
export const DISCOUNTED_PAYMENTS: PaymentMethodId[] = ["transferencia", "efectivo"];

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

  let paymentAdjustment = 0;
  if (DISCOUNTED_PAYMENTS.includes(paymentMethod)) {
    paymentAdjustment = -Math.round(afterCoupon * TRANSFER_DISCOUNT);
  }

  let total = afterCoupon + paymentAdjustment + shippingCost;

  // Las cuotas solo aplican a la tarjeta, o sea Mercado Pago. Las financia el
  // gateway, no nosotros: acá solo se refleja el efecto en el total para que lo
  // que ve el comprador coincida con lo que le cobra Mercado Pago.
  if (paymentMethod === "mercadopago") {
    const plan = INSTALLMENT_PLANS.find((p) => p.count === installments) ?? INSTALLMENT_PLANS[0];
    const withInterest = Math.round(total * plan.coefficient);
    paymentAdjustment = withInterest - total;
    total = withInterest;
  }

  const installmentAmount =
    paymentMethod === "mercadopago" && installments > 1 ? Math.round(total / installments) : total;

  const listSubtotal = input.listSubtotal ?? subtotal;

  return {
    subtotal,
    couponDiscount,
    paymentAdjustment,
    shippingCost,
    total,
    installmentAmount,
    savings: Math.max(0, listSubtotal - subtotal) + couponDiscount + Math.max(0, -paymentAdjustment),
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
