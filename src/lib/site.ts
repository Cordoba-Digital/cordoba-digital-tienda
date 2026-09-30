/**
 * Dominio del sitio, en un solo lugar.
 *
 * Antes el dominio estaba escrito a mano en cinco archivos (metadataBase, los
 * canonicals de guías, robots.txt y los dos generadores de sitemap) y además no
 * coincidían entre sí: los canonicals de productos, categorías y guías apuntaban
 * a www.cordobadigital.net mientras la home y el catálogo no tenían canonical
 * ninguno. Con eso Google recibía señales contradictorias y el sitemap
 * declaraba estar en otro dominio.
 *
 * Ahora todos los canonicals son relativos y se resuelven contra `SITE_URL`, así
 * que cuando se publique en el dominio real alcanza con cambiar la variable
 * `SITE_URL` y nada más.
 *
 * No lleva el prefijo `NEXT_PUBLIC_` porque este valor solo se usa en el
 * servidor: no hace falta que llegue al cliente.
 */

const CRUDA = (process.env.SITE_URL ?? "https://cordoba-digital.vercel.app").replace(/\/+$/, "");

/** Origen del sitio, sin barra final. Ej.: `https://cordoba-digital.vercel.app` */
export const SITE_URL = CRUDA;

/** Une una ruta interna al origen. Ej.: `url("/productos")`. */
export function url(ruta = "/"): string {
  return `${SITE_URL}${ruta.startsWith("/") ? ruta : `/${ruta}`}`;
}
