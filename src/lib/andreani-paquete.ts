/**
 * Peso y medidas de envío de un producto, leídos de los campos de texto
 * `products.weight` y `products.dimensions` que se cargan en el panel.
 *
 * Los campos son texto libre ("0.4 kg", "400 g", "20 × 12 × 6 cm",
 * "10x10x20 cm"). Andreani cobra por peso volumétrico, así que lo que manda
 * son las medidas: sin medidas no se cotiza con Andreani y el checkout usa
 * las tarifas fijas por zona (`tarifas-envio.ts`). El peso es secundario:
 * si falta se toma 1 kg, que es lo que cobra el escalón más bajo.
 *
 * Archivo sin dependencias de servidor para poder probarlo con `tsx`.
 */

export type MedidasEnvio = {
  /** Centímetros enteros, mínimo 1. */
  largo: number;
  ancho: number;
  alto: number;
  /** Kilos (puede tener decimales). */
  kilos: number;
};

/** Peso que se asume cuando el producto no tiene uno cargado. */
export const KILOS_POR_DEFECTO = 1;

function numero(texto: string): number | null {
  const n = Number(texto.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Kilos a partir del texto del panel. Sin unidad se asume kg, que es como lo
 * guardaba WooCommerce. Devuelve null si no hay un número positivo.
 */
export function parsearPeso(texto: string | null | undefined): number | null {
  const limpio = (texto ?? "").trim().toLowerCase();
  if (!limpio) return null;
  const match = limpio.match(/(\d+(?:[.,]\d+)?)\s*(kg|kilos?|g|gr|grs|gramos?)?\b/);
  if (!match) return null;
  const valor = numero(match[1]);
  if (valor === null) return null;
  const unidad = match[2] ?? "kg";
  return unidad.startsWith("k") ? valor : valor / 1000;
}

/**
 * Tres medidas en cm a partir de "20 × 12 × 6 cm", "10x10x20", "20 x 12 x 6"
 * o con "mm"/"m" al final. Devuelve null si no hay exactamente tres números.
 */
export function parsearMedidas(texto: string | null | undefined): { largo: number; ancho: number; alto: number } | null {
  const limpio = (texto ?? "").trim().toLowerCase();
  if (!limpio) return null;
  const numeros = limpio.match(/\d+(?:[.,]\d+)?/g);
  if (!numeros || numeros.length !== 3) return null;
  const valores = numeros.map(numero);
  if (valores.some((v) => v === null)) return null;
  const factor = /\bmm\b/.test(limpio) ? 0.1 : /\d\s*m\b/.test(limpio) && !/cm/.test(limpio) ? 100 : 1;
  const [largo, ancho, alto] = (valores as number[]).map((v) => Math.max(1, Math.round(v * factor)));
  return { largo, ancho, alto };
}

/** Medidas de envío completas, o null si el producto no se puede cotizar. */
export function medidasDeEnvio(producto: { weight: string | null; dimensions: string | null }): MedidasEnvio | null {
  const medidas = parsearMedidas(producto.dimensions);
  if (!medidas) return null;
  return { ...medidas, kilos: parsearPeso(producto.weight) ?? KILOS_POR_DEFECTO };
}
