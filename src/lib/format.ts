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
 * `tarifas-envio.ts`, los rangos de `catalog-filters.tsx` y `centsToUnits` en
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
export function installmentValue(totalCents: number, count: number): number {
  return Math.round(totalCents / count);
}


// No hay descuento por medio de pago. Existió un 15% para transferencia y
// efectivo, pero el checkout del sitio original da subtotal igual al total, sin
// línea de descuento. Se eliminó el 2026-09, después de leer el checkout real.

// Tampoco hay envío gratis por monto. Existió un umbral de $250.000, pero el
// sitio original no lo menciona en el home, ni en la ficha de producto, ni en
// ninguna parte: se comprobó el 2026-09. Los 2.589 productos tienen
// `free_shipping = false`. La única entrega sin cargo es el retiro en el local,
// que de verdad es gratis.

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
