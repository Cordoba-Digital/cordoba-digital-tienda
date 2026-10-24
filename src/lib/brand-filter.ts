/**
 * Marcas del filtro `?marca=` del catálogo, listas para comparar sin
 * distinguir mayúsculas.
 *
 * Las direcciones viejas del WordPress (`/marca/apple`, `/marca/tp-link`)
 * redirigen a `/productos?marca=<slug>` con el slug en minúscula, mientras que
 * la base guarda el nombre ("Apple", "TP-Link"). Comparando exacto, las 29
 * marcas del sitio viejo mostraban un listado vacío.
 */
export function marcasDelFiltro(marcas: string[]): string[] {
  return [...new Set(marcas.map((marca) => marca.trim().toLowerCase()).filter(Boolean))];
}
