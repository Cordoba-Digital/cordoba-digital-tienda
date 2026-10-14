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
  { id: "accesos", label: "Accesos rápidos", description: "Atajos a ofertas, más vendidos, envíos, retiro y pagos." },
  { id: "categorias", label: "Categorías", description: "Fila desplazable con las categorías y su cantidad de productos." },
  { id: "ofertas", label: "Ofertas relámpago", description: "Panel oscuro con las ofertas y el contador hasta la medianoche." },
  { id: "mas-vendidos", label: "Más vendidos", description: "Los 8 productos que más salen, con Top 1, 2 y 3." },
  { id: "por-categoria", label: "Explorá por categoría", description: "Pestañas con las categorías con más productos y una fila de cada una." },
  { id: "pagos-retiro", label: "Pagos y retiro", description: "Dos tarjetas: transferencia o efectivo, y retiro en el local." },
  { id: "destacados", label: "Destacados", description: "Productos marcados como destacados que no aparecen arriba." },
  { id: "local", label: "El local", description: "Foto del local, dirección, horarios y WhatsApp." },
  { id: "guias", label: "Guías de compra", description: "Las tres primeras guías publicadas." },
  { id: "explorar", label: "Seguí explorando", description: "Grilla con más productos y un botón para cargar más, para que la home no termine en seco." },
  { id: "preguntas", label: "Preguntas y newsletter", description: "Preguntas frecuentes y suscripción al newsletter." },
] as const satisfies readonly { id: string; label: string; description: string; fixed?: boolean }[];

export type HomeBlockId = (typeof HOME_BLOCKS)[number]["id"];

export type HomeLayoutItem = { id: HomeBlockId; visible: boolean };

const IDS = new Set<string>(HOME_BLOCKS.map((block) => block.id));

function isBlockId(value: unknown): value is HomeBlockId {
  return typeof value === "string" && IDS.has(value);
}

/** El orden recomendado: productos primero y lo informativo más abajo. */
export function defaultHomeLayout(): HomeLayoutItem[] {
  return HOME_BLOCKS.map((block) => ({ id: block.id, visible: true }));
}

/**
 * Convierte lo guardado (o lo que manda el panel) en una lista válida: ignora
 * bloques desconocidos y repetidos y deja la portada primera y visible. Los
 * bloques que todavía no estaban guardados se suman visibles y en su lugar
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
    items.splice(items.findIndex((item) => item.id === before) + 1, 0, { id: block.id, visible: true });
    seen.add(block.id);
  });
  return items;
}

/** Ids de los bloques que se dibujan, en orden. */
export function visibleHomeBlocks(layout: HomeLayoutItem[]): HomeBlockId[] {
  return layout.filter((item) => item.visible).map((item) => item.id);
}
