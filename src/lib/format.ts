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
 * almacenamiento, hay que cambiar estos dos formateadores, los costos de
 * `tarifas-envio.ts`, los rangos de `catalog-filters.tsx` y `pesosToUnits` en
 * `mercadopago.ts`, todo junto.
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

/** Pesos argentinos enteros, tal como se guardan en `products.price`. */
export type PesosARS = number;

/** Precio en pesos enteros tal como viene de WooCommerce. */
export function money(price: PesosARS): string {
  return arsFormatter.format(Math.round(price));
}

export function moneyExact(price: PesosARS): string {
  return arsFormatterExact.format(Math.round(price));
}

export function discountPercent(price: PesosARS, compareAt?: number | null): number {
  if (!compareAt || compareAt <= price) return 0;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

/**
 * Sube un precio al siguiente tope redondo (1, 1,5, 2, 2,5, 3, 5 o 7,5 por una
 * potencia de 10): 99.999 da 100.000 y 35.378 da 50.000. Sirve para títulos
 * como "Por menos de $100.000", que con un número exacto no se leen.
 */
export function roundPriceCap(price: PesosARS): PesosARS {
  if (!Number.isFinite(price) || price <= 0) return 0;
  const power = 10 ** Math.floor(Math.log10(price));
  const step = [1, 1.5, 2, 2.5, 3, 5, 7.5, 10].find((s) => s * power >= price) ?? 10;
  return Math.round(step * power);
}

/**
 * NO hay planes de cuotas en esta tienda, y no se inventan.
 *
 * Antes esta tabla decía "3 cuotas sin interés", "6 cuotas sin interés",
 * "9 cuotas fijas" (×1,12) y "12 cuotas fijas" (×1,22), y con ella el selector
 * "Simulá tus cuotas" de la ficha, la línea "6 cuotas de $..." de cada card y la
 * lista del marquee. Nada de eso existe en el sitio original: se buscó
 * "cuota", "financia" y "sin interés" en la home, /contacto/, la ficha de
 * producto y la política de garantía, y no hay una sola coincidencia.
 *
 * Los coeficientes además no eran de nadie: el 1,12 y el 1,22 no salen de
 * ningún cálculo, así que el sitio estaba inventando el interés a mostrar.
 *
 * Cuando el cliente confirme si ofrece cuotas, lo que corresponde es tomar los
 * planes reales de la cuenta de Mercado Pago, no volver a una tabla fija acá.
 * Mientras tanto, las cuotas que sí aparecen en el checkout (el monto por
 * cuota que devuelve Mercado Pago al pagar con tarjeta) son dato real de la
 * pasarela y no se tocan.
 */
export function installmentValue(totalPesos: PesosARS, count: number): number {
  return Math.round(totalPesos / count);
}


// No hay descuento por medio de pago. Existió un 15% para transferencia y
// efectivo, pero el checkout del sitio original da subtotal igual al total, sin
// línea de descuento. Se eliminó el 2026-09, después de leer el checkout real.

// Tampoco hay envío gratis por monto. Existió un umbral de $250.000, pero el
// sitio original no lo menciona en el home, ni en la ficha de producto, ni en
// ninguna parte: se comprobó el 2026-09. Los 2.589 productos tienen
// `free_shipping = false`. La única entrega sin cargo es el retiro en el local,
// que de verdad es gratis.

/** El servidor corre en UTC: las fechas se muestran siempre con la hora de Córdoba. */
const STORE_TZ = "America/Argentina/Cordoba";

export function formatDate(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: STORE_TZ,
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: STORE_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** "hace 5 min", "hace 3 h", "ayer 18:40", "lunes 10:15" o "12/10 09:30" (hora de Córdoba). */
export function formatAgo(value: Date | string, now = new Date()): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  if (minutes < 6 * 60) return `hace ${Math.floor(minutes / 60)} h`;
  const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: STORE_TZ }).format(d);
  const time = new Intl.DateTimeFormat("es-AR", { timeZone: STORE_TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60_000);
  if (day(date) === day(now)) return `hoy ${time}`;
  if (day(date) === day(yesterday)) return `ayer ${time}`;
  if (minutes < 6 * 24 * 60) {
    const weekday = new Intl.DateTimeFormat("es-AR", { timeZone: STORE_TZ, weekday: "long" }).format(date);
    return `${weekday} ${time}`;
  }
  const short = new Intl.DateTimeFormat("es-AR", { timeZone: STORE_TZ, day: "2-digit", month: "2-digit" }).format(date);
  return `${short} ${time}`;
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
