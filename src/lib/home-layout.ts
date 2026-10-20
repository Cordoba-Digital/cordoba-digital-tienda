/**
 * La home se arma con bloques, en el orden y con la visibilidad que se elige
 * en Panel → Inicio (el "server-driven UI" de Mercado Libre: el servidor dice
 * qué piezas van y en qué orden, y la página solo las dibuja).
 *
 * Este archivo lo usa también el navegador (el editor del panel): solo tiene
 * el catálogo de bloques y la validación. La lectura y el guardado en la base
 * viven en `home-layout-server.ts`.
 */

export const HOME_BLOCKS = [
  { id: "portada", label: "Portada", description: "Carrusel principal y cintillo de confianza. Va siempre primero.", fixed: true },
  { id: "vistos", label: "Seguí donde lo dejaste", description: "Los últimos productos que miró cada visitante. Solo aparece si ya vio alguno." },
  { id: "categorias", label: "Categorías", description: "Fila desplazable con las categorías y su cantidad de productos." },
  { id: "ofertas", label: "Ofertas", description: "Los productos con precio rebajado y stock, de mayor a menor descuento." },
  { id: "vitrinas", label: "Vitrinas de categorías", description: "Tres tarjetas grandes con foto que llevan a las categorías principales." },
  { id: "mas-vendidos", label: "Más vendidos", description: "Los 8 productos que más salen, con Top 1, 2 y 3." },
  // La home larga, al estilo de Mercado Libre: filas de productos de las
  // categorías que no salen arriba, cortadas con banners y vitrinas.
  { id: "banners", label: "Banners de categorías", description: "Dos banners anchos, uno oscuro y uno claro, con fotos de dos categorías." },
  { id: "filas-categoria", label: "Más categorías (1)", description: "Dos filas de productos de categorías que no aparecen más arriba." },
  { id: "vitrinas-2", label: "Más vitrinas", description: "Otras tres categorías con foto, para cortar entre filas de productos." },
  { id: "por-categoria", label: "Explorá por categoría", description: "Pestañas con las categorías con más productos y una fila de cada una." },
  { id: "precio", label: "Por menos de…", description: "Productos con stock hasta un precio redondo que sale del catálogo, rebajados primero." },
  { id: "filas-categoria-2", label: "Más categorías (2)", description: "Otras dos filas de productos de categorías que no aparecen más arriba." },
  { id: "destacados", label: "Destacados", description: "Productos marcados como destacados que no aparecen arriba." },
  { id: "categorias-grilla", label: "Todas las categorías", description: "Grilla con una foto de cada categoría, cerca del final." },
  { id: "explorar", label: "Seguí explorando", description: "Grilla con más productos y un botón para cargar más." },
  { id: "pagos-retiro", label: "Comprá tranquilo", description: "Franja corta con pagos, retiro en el local y atención por WhatsApp." },
  // Desde acá, ocultos de entrada: repiten lo que ya dicen el header, la franja
  // de "Comprá tranquilo" o el pie. Se prenden desde el panel.
  { id: "accesos", label: "Accesos rápidos", description: "Atajos a ofertas, más vendidos, envíos, retiro y pagos.", hidden: true },
  { id: "local", label: "El local", description: "Foto del local, dirección, horarios y WhatsApp.", hidden: true },
  { id: "guias", label: "Guías de compra", description: "Las tres primeras guías publicadas.", hidden: true },
  { id: "preguntas", label: "Preguntas frecuentes", description: "Las preguntas de siempre sobre envíos, garantía y pagos.", hidden: true },
] as const satisfies readonly { id: string; label: string; description: string; fixed?: boolean; hidden?: boolean }[];

export type HomeBlockId = (typeof HOME_BLOCKS)[number]["id"];

export type HomeLayoutItem = { id: HomeBlockId; visible: boolean };

const IDS = new Set<string>(HOME_BLOCKS.map((block) => block.id));

function isBlockId(value: unknown): value is HomeBlockId {
  return typeof value === "string" && IDS.has(value);
}

/** Si un bloque arranca visible cuando no hay nada guardado. */
function visibleByDefault(block: (typeof HOME_BLOCKS)[number]): boolean {
  return !("hidden" in block && block.hidden);
}

/**
 * El orden recomendado: una home larga como la de Mercado Libre, con filas de
 * productos, vitrinas y banners intercalados, la grilla de categorías y la
 * grilla que carga más al final, y una sola franja informativa de cierre.
 */
export function defaultHomeLayout(): HomeLayoutItem[] {
  return HOME_BLOCKS.map((block) => ({ id: block.id, visible: visibleByDefault(block) }));
}

/**
 * Convierte lo guardado (o lo que manda el panel) en una lista válida: ignora
 * bloques desconocidos y repetidos y deja la portada primera y visible. Los
 * bloques que todavía no estaban guardados se suman (visibles, salvo los que
 * arrancan ocultos) y en su lugar
 * del orden recomendado (justo después del bloque que los precede ahí), así
 * uno nuevo aparece solo, sin tener que tocar el panel y sin quedar al fondo.
 * Ante cualquier forma rara devuelve la home por defecto.
 */
export function parseHomeLayout(json: unknown): HomeLayoutItem[] {
  if (!Array.isArray(json)) return defaultHomeLayout();
  const seen = new Set<HomeBlockId>();
  const items: HomeLayoutItem[] = [{ id: "portada", visible: true }];
  for (const entry of json) {
    const id = entry && typeof entry === "object" ? (entry as { id?: unknown }).id : undefined;
    if (!isBlockId(id) || seen.has(id) || id === "portada") continue;
    seen.add(id);
    items.push({ id, visible: (entry as { visible?: unknown }).visible !== false });
  }
  HOME_BLOCKS.forEach((block, index) => {
    if (block.id === "portada" || seen.has(block.id)) return;
    const before = HOME_BLOCKS[index - 1].id;
    items.splice(items.findIndex((item) => item.id === before) + 1, 0, { id: block.id, visible: visibleByDefault(block) });
    seen.add(block.id);
  });
  return items;
}

/** Ids de los bloques que se dibujan, en orden. */
export function visibleHomeBlocks(layout: HomeLayoutItem[]): HomeBlockId[] {
  return layout.filter((item) => item.visible).map((item) => item.id);
}

/**
 * La franja naranja de avisos que va arriba del header. Se prende y se apaga
 * en Panel → Inicio y se guarda aparte del orden de la home porque se ve en
 * todas las páginas.
 */
export function parseTopBar(json: unknown): boolean {
  return !(json && typeof json === "object" && (json as { visible?: unknown }).visible === false);
}
