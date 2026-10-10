/**
 * Categorías heredadas de WooCommerce que se fusionan en otra.
 *
 * Son duplicados ("Router AP" y "Router") o subcategorías de marca con 1 a 3
 * productos, que repiten lo que ya hace el filtro de marca de la tienda. La
 * fusión la aplica `npm run categorias:limpiar -- --apply`; esta lista también
 * la usa la página de categoría para redirigir con 308 la URL vieja una vez
 * que la categoría ya no existe, así que el redirect no se activa antes de
 * aplicar el script.
 *
 * `from` e `into` son rutas completas de slugs, como en `/categoria/<ruta>`.
 * `marca` se completa en los productos de `from` que no tengan marca, y el
 * redirect lleva a `into?marca=<marca>` para que la URL vieja siga mostrando
 * lo mismo.
 */
export type CategoryMerge = {
  from: string;
  into: string;
  marca?: string;
  motivo: string;
};

export const CATEGORY_MERGES: CategoryMerge[] = [
  // Duplicados
  { from: "conectividad/router-ap", into: "conectividad/router", motivo: "duplicado de Router" },
  {
    from: "accesorios-p-celulares/parlantes-bluetooth",
    into: "audio-y-video/parlantes-cordoba",
    motivo: "Parlantes Bluetooth estaba en dos lugares",
  },
  { from: "calefaccion", into: "aires-acondicionados/calefaccion-y-caloventores", motivo: "raíz con un solo producto" },

  // Subcategorías de marca chicas: quedan en el padre y se encuentran con el filtro de marca
  { from: "conectividad/switch/tp-link", into: "conectividad/switch", marca: "TP-Link", motivo: "marca con 1 producto" },
  {
    from: "computacion/notebooks-cordoba/gateway",
    into: "computacion/notebooks-cordoba",
    marca: "Gateway",
    motivo: "marca con 1 producto",
  },
  { from: "computacion/notebooks-cordoba/asus", into: "computacion/notebooks-cordoba", marca: "Asus", motivo: "marca con 3 productos" },
  { from: "celulares-cordoba/celulares-google", into: "celulares-cordoba", marca: "Google", motivo: "marca con 1 producto" },
  { from: "celulares-cordoba/celulares-huawei", into: "celulares-cordoba", marca: "Huawei", motivo: "marca con 1 producto" },
  {
    from: "camaras-digitales/camaras-reflex/fujifilm",
    into: "camaras-digitales/camaras-reflex",
    marca: "Fujifilm",
    motivo: "marca con 2 productos",
  },
  {
    from: "camaras-digitales/camaras-semi-reflex-bridge/nikon-camaras-semi-reflex-bridge",
    into: "camaras-digitales/camaras-semi-reflex-bridge",
    marca: "Nikon",
    motivo: "marca con 1 producto",
  },
];

/** URL a la que redirige una ruta de categoría fusionada, o null si no es una. */
export function mergedCategoryRedirect(path: string): string | null {
  const merge = CATEGORY_MERGES.find((m) => m.from === path);
  if (!merge) return null;
  const query = merge.marca ? `?marca=${encodeURIComponent(merge.marca)}` : "";
  return `/categoria/${merge.into}${query}`;
}
