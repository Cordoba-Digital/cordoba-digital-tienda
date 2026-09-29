/**
 * Precios: **pesos argentinos enteros**, no centavos.
 *
 * Ojo con esto, que ya causó un bug. WooCommerce publica `3299999` para
 * $3.299.999, y ese mismo número es lo que guardamos en `products.price`. Las
 * primeras versiones de este archivo llamaban "cents" a esos valores y
 * dividían entre 100 al formatear, así que la tienda mostraba $33.000 por un
 * celular de $3.299.999 y Mercado Pong habría cobrado esa cifra.
 *
 * Verificado contra `/producto/iphone-18-pro-max-512gb`: el entero crudo es
 * idéntico en WooCommerce y en la base. Si algún día se cambia la escala de
 * almacenamiento, hay que cambiar estos dos formateadores, `FREE_SHIPPING_THRESHOLD`,
 * los costos de `shipping.ts`, los rangos de `catalog-filters.tsx` y
 * `centsToUnits` en `mercadopago.ts`, todo junto.
 */
const arsFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const arsFormatterExact = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Precio en pesos enteros tal como viene de WooCommerce. */
export function money(price: number): string {
  return arsFormatter.format(Math.round(price));
}

export function moneyExact(price: number): string {
  return arsFormatterExact.format(Math.round(price));
}

export function discountPercent(price: number, compareAt?: number | null): number {
  if (!compareAt || compareAt <= price) return 0;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

/** Card installment plans available in the store. */
export const INSTALLMENT_PLANS = [
  { count: 1, coefficient: 1, label: "1 pago" },
  { count: 3, coefficient: 1, label: "3 cuotas sin interés" },
  { count: 6, coefficient: 1, label: "6 cuotas sin interés" },
  { count: 9, coefficient: 1.12, label: "9 cuotas fijas" },
  { count: 12, coefficient: 1.22, label: "12 cuotas fijas" },
] as const;

export function installmentValue(totalCents: number, count: number): number {
  const plan = INSTALLMENT_PLANS.find((p) => p.count === count) ?? INSTALLMENT_PLANS[0];
  return Math.round((totalCents * plan.coefficient) / count);
}

export function installmentTotal(totalCents: number, count: number): number {
  const plan = INSTALLMENT_PLANS.find((p) => p.count === count) ?? INSTALLMENT_PLANS[0];
  return Math.round(totalCents * plan.coefficient);
}

/** Cash / bank transfer / crypto discount. */
export const TRANSFER_DISCOUNT = 0.15;

export function transferPrice(price: number): number {
  return Math.round(price * (1 - TRANSFER_DISCOUNT));
}

/** Envío gratis a partir de $250.000, como dice el sitio. Pesos enteros. */
export const FREE_SHIPPING_THRESHOLD = 250_000;

export function formatDate(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function addBusinessDays(days: number, from = new Date()): Date {
  const date = new Date(from);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return date;
}

export function etaLabel(minDays: number, maxDays: number): string {
  const start = addBusinessDays(minDays);
  const end = addBusinessDays(maxDays);
  const fmt = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });
  if (minDays === maxDays) return `Llega el ${fmt.format(start)}`;
  return `Llega entre el ${fmt.format(start)} y el ${fmt.format(end)}`;
}

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
