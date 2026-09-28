const arsFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const arsFormatterCents = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Prices are stored as integer ARS cents. */
export function money(cents: number): string {
  return arsFormatter.format(Math.round(cents) / 100);
}

export function moneyExact(cents: number): string {
  return arsFormatterCents.format(cents / 100);
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

export function transferPrice(cents: number): number {
  return Math.round(cents * (1 - TRANSFER_DISCOUNT));
}

export const FREE_SHIPPING_THRESHOLD = 250_000_00; // ARS 250.000 in cents

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
