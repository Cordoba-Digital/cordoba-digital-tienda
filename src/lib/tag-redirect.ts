/**
 * Adónde lleva una etiqueta vieja del WordPress (`/etiqueta-producto/<tag>`).
 *
 * El sitio viejo publicaba unas 3.950 etiquetas, muchas frases con "cordoba"
 * al final ("nikon-d750-body-cordoba"). Antes se mandaban tal cual a
 * `/productos?q=<tag>`, y la búsqueda con guiones y "cordoba" casi nunca
 * encontraba nada: Google recibía miles de listados vacíos.
 *
 * Ahora: si la etiqueta es de un solo producto, va a su ficha; si no, a la
 * búsqueda con las palabras de la etiqueta, sin guiones ni "cordoba".
 */

/** Palabras que en las etiquetas viejas solo decían dónde está el local. */
const RELLENO = new Set(["cordoba", "corodoba", "cordova", "cba"]);

/** Las formas en que la etiqueta puede estar guardada: tal cual y decodificada. */
export function formasDeEtiqueta(tag: string): string[] {
  const cruda = tag.trim().toLowerCase();
  let decodificada = cruda;
  try {
    decodificada = decodeURIComponent(cruda).toLowerCase();
  } catch {
    // Un `%` suelto: queda la forma cruda.
  }
  return [...new Set([cruda, decodificada].filter(Boolean))];
}

/** "nikon-d750-body-cordoba" → "nikon d750 body". */
export function palabrasDeEtiqueta(tag: string): string {
  const [forma] = formasDeEtiqueta(tag).slice(-1);
  return (forma ?? "")
    .split(/[-_\s]+/)
    .filter((palabra) => palabra && !RELLENO.has(palabra.normalize("NFD").replace(/[̀-ͯ]/g, "")))
    .join(" ");
}

/**
 * Ruta de destino. `productos` son los slugs de los productos que tienen esa
 * etiqueta (alcanza con pedir dos: solo importa si hay exactamente uno).
 */
export function destinoDeEtiqueta(tag: string, productos: string[]): string {
  if (productos.length === 1) return `/producto/${productos[0]}`;
  const palabras = palabrasDeEtiqueta(tag);
  return palabras ? `/productos?q=${encodeURIComponent(palabras)}` : "/productos";
}
