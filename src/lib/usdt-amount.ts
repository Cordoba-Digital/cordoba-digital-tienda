/**
 * Montos en USDT. Los pesos son enteros; los USDT se manejan como texto
 * decimal ("73.45") y se comparan en millonésimas (los 6 decimales del token),
 * sin pasar por float. Lo usan el servidor y el checkout en el navegador.
 */

const MICRO = BigInt(1_000_000);

/** "73.45" → 73450000n. null si no es un número positivo con hasta 6 decimales. */
export function toMicroUsdt(value: string): bigint | null {
  const match = /^(\d+)(?:\.(\d{1,6}))?$/.exec(value.trim());
  if (!match) return null;
  return BigInt(match[1]) * MICRO + BigInt((match[2] ?? "").padEnd(6, "0"));
}

/**
 * Cuántos USDT corresponden a un total en pesos con la cotización dada
 * (pesos por dólar). Se redondea para arriba al centavo de dólar: a la tienda
 * nunca le llega menos que el total.
 */
export function usdtAmountFor(totalPesos: number, rate: number): string {
  if (!(rate > 0) || !(totalPesos >= 0)) throw new Error("Cotización o total inválido.");
  // Centavos de dólar = pesos × 100 / cotización, con la cotización pasada a
  // centésimas para que la división sea entera.
  const rateCents = BigInt(Math.round(rate * 100));
  const numerator = BigInt(Math.round(totalPesos)) * BigInt(10_000);
  const cents = (numerator + rateCents - BigInt(1)) / rateCents;
  const whole = cents / BigInt(100);
  const fraction = (cents % BigInt(100)).toString().padStart(2, "0");
  return `${whole}.${fraction}`;
}

/**
 * Dólares enteros para mostrar debajo de un precio en pesos ("USD 960"), o
 * null sin cotización. Para arriba, igual que el cobro: el número que ve el
 * cliente nunca es menor que lo que después paga en USDT.
 */
export function usdFor(pricePesos: number, rate: number | null): number | null {
  if (!rate || !(rate > 0) || !(pricePesos > 0)) return null;
  return Math.ceil(Number(usdtAmountFor(pricePesos, rate)));
}

/** Lo que falta para llegar al monto esperado ("0" si llegó completo o de más). */
export function usdtShortfall(received: string, expected: string): string {
  const got = toMicroUsdt(received);
  const want = toMicroUsdt(expected);
  if (got === null || want === null) return expected;
  if (got >= want) return "0";
  const diff = want - got;
  const fraction = (diff % MICRO).toString().padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${diff / MICRO}.${fraction}` : `${diff / MICRO}`;
}

/** "73.45" → "73,45" para mostrar en pantalla. */
export function formatUsdt(value: string): string {
  return value.replace(".", ",");
}
