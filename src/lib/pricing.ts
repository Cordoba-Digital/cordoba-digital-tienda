import { INSTALLMENT_PLANS, TRANSFER_DISCOUNT } from "@/lib/format";

export type PaymentMethodId = "transferencia" | "tarjeta" | "mercadopago" | "efectivo";

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
    label: "Transferencia bancaria o USDT",
    short: "Transferencia / USDT",
    description: "Te enviamos el CBU o la wallet al confirmar. Acreditación inmediata.",
    icon: "🏦",
    perk: "15% OFF",
  },
  {
    id: "tarjeta",
    label: "Tarjeta de crédito",
    short: "Tarjeta de crédito",
    description: "Visa, Mastercard, Amex, Naranja X y Cabal. Hasta 6 cuotas sin interés.",
    icon: "💳",
    perk: "6 cuotas sin interés",
  },
  {
    id: "mercadopago",
    label: "Mercado Pago",
    short: "Mercado Pago",
    description: "Pagás con tu cuenta, dinero en cuenta o tarjeta guardada.",
    icon: "💠",
  },
  {
    id: "efectivo",
    label: "Efectivo en el local",
    short: "Efectivo en el local",
    description: "Reservás online y pagás al retirar en 27 de Abril 259.",
    icon: "💵",
    perk: "15% OFF",
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

  let paymentAdjustment = 0;
  if (paymentMethod === "transferencia" || paymentMethod === "efectivo") {
    paymentAdjustment = -Math.round(afterCoupon * TRANSFER_DISCOUNT);
  }

  let total = afterCoupon + paymentAdjustment + shippingCost;

  if (paymentMethod === "tarjeta") {
    const plan = INSTALLMENT_PLANS.find((p) => p.count === installments) ?? INSTALLMENT_PLANS[0];
    const withInterest = Math.round(total * plan.coefficient);
    paymentAdjustment = withInterest - total;
    total = withInterest;
  }

  const installmentAmount =
    paymentMethod === "tarjeta" && installments > 1 ? Math.round(total / installments) : total;

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
