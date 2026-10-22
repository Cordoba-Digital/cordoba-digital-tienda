/**
 * Cantidad disponible que se muestra en los productos en oferta.
 *
 * El `stock` del catálogo migrado de WooCommerce es casi siempre 1 y significa
 * "hay", no una cantidad (2.369 de 2.589 productos). Por eso solo se muestra
 * un número cuando es mayor a 1: eso solo pasa cuando alguien cargó la
 * cantidad real desde el panel. Para las promos (CACE pide informar el stock
 * de los productos en oferta) César carga la cantidad real de cada uno.
 */
export function offerStockCount(product: { stock: number; price: number; compareAtPrice: number | null }): number | null {
  const onOffer = product.compareAtPrice != null && product.compareAtPrice > product.price;
  if (!onOffer || product.stock <= 1) return null;
  return product.stock;
}

export function unitsLabel(count: number): string {
  return `${count.toLocaleString("es-AR")} ${count === 1 ? "unidad disponible" : "unidades disponibles"}`;
}
