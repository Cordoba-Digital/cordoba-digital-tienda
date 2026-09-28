/**
 * Utilidades puras para trabajar con el árbol de categorías.
 *
 * El catálogo real de WooCommerce tiene 3 niveles (p. ej.
 * `computacion/notebooks-cordoba/asus`), así que en memoria funcionamos siempre
 * con el árbol completo y derivamos lo que haga falta. Son 128 filas: es más
 * barato y simple que traer joins recursivos de Postgres.
 */

export type CategoryRow = {
  id: number;
  slug: string;
  name: string;
  icon: string;
  tagline: string;
  sortOrder: number;
  parentId: number | null;
  descriptionHtml: string;
  imageUrl: string | null;
};

export type CategoryNode = CategoryRow & {
  /** Ruta completa de slugs, ej. `computacion/notebooks-cordoba/asus`. */
  path: string;
  depth: number;
  children: CategoryNode[];
};

export type CategoryWithCount = CategoryNode & { count: number };

/** Construye el árbol a partir de filas planas, resolviente slugs duplicados. */
export function buildCategoryTree(rows: CategoryRow[]): CategoryNode[] {
  const byId = new Map<number, CategoryRow>();
  for (const row of rows) byId.set(row.id, row);

  const nodes = new Map<number, CategoryNode>();
  for (const row of rows) {
    nodes.set(row.id, { ...row, path: row.slug, depth: 0, children: [] });
  }

  const roots: CategoryNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId != null ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const assignPaths = (node: CategoryNode, prefix: string[], depth: number) => {
    node.path = [...prefix, node.slug].join("/");
    node.depth = depth;
    node.children.sort(compareCategories);
    for (const child of node.children) assignPaths(child, [...prefix, node.slug], depth + 1);
  };
  for (const root of roots) assignPaths(root, [], 0);
  roots.sort(compareCategories);

  return roots;
}

function compareCategories(a: CategoryNode, b: CategoryNode): number {
  return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
}

export function flattenTree<T extends CategoryNode>(nodes: T[]): T[] {
  const out: T[] = [];
  const walk = (list: CategoryNode[]) => {
    for (const node of list) {
      out.push(node as T);
      walk(node.children);
    }
  };
  walk(nodes);
  return out;
}

/** Devuelve el nodo del árbol cuya ruta (array de slugs) coincide exactamente. */
export function findByPath<T extends CategoryNode>(nodes: T[], segments: string[]): T | null {
  let level: T[] = nodes;
  let found: T | null = null;
  for (const segment of segments) {
    const lower = segment.toLowerCase();
    found = level.find((n) => n.slug.toLowerCase() === lower) ?? null;
    if (!found) return null;
    level = found.children as T[];
  }
  return found;
}

/** Devuelve el nodo del árbol buscado por slug en cualquier nivel. */
export function findBySlug<T extends CategoryNode>(nodes: T[], slug: string): T | null {
  const lower = slug.toLowerCase();
  return flattenTree(nodes).find((n) => n.slug.toLowerCase() === lower) ?? null;
}

/** El nodo y todos sus descendientes, con el propio nodo al principio. */
export function withDescendants<T extends CategoryNode>(node: T): T[] {
  return [node, ...(flattenTree(node.children) as T[])];
}

/** Cadena de ancestros, de la raíz al padre (sin incluir el nodo). */
export function ancestorsOf<T extends CategoryNode>(node: T, byId: Map<number, T>): T[] {
  const chain: T[] = [];
  let current = node.parentId != null ? byId.get(node.parentId) : undefined;
  const seen = new Set<number>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.unshift(current);
    current = current.parentId != null ? byId.get(current.parentId) : undefined;
  }
  return chain;
}

/** Suma `count` por categoría, incluyendo los productos de sus descendientes. */
export function countByCategory(
  nodes: CategoryNode[],
  directCounts: Map<number, number>,
): Map<number, number> {
  const out = new Map<number, number>();
  const walk = (node: CategoryNode): number => {
    let total = directCounts.get(node.id) ?? 0;
    for (const child of node.children) total += walk(child);
    out.set(node.id, total);
    return total;
  };
  for (const root of nodes) walk(root);
  return out;
}

/** Asigna un ícono por defecto según el nombre de la categoría raíz. */
const ICON_HINTS: { match: RegExp; icon: string }[] = [
  { match: /celular|smartwatch|smartband/i, icon: "📱" },
  { match: /accesorio|cargador|cable|adaptador|audio|auricular|parlante/i, icon: "🎧" },
  { match: /notebook|comput|monitor|tablet|perifer|componente|hardware|placa|disco|memoria|gabinete|fuente|ups|silla|joystick|joystic/i, icon: "💻" },
  { match: /camara|lente|flash|gimbal|filmadora|foto|dron/i, icon: "📷" },
  { match: /consola|playstation|videojueg|jueg/i, icon: "🎮" },
  { match: /televis|proyector|pantalla|smart ?tv|convertidor/i, icon: "📺" },
  { match: /electrodomestic|lavarropas|heladera|aspiradora|cafetera|pava|licuadora|horno|placha|batidora|tostadora|microondas|freidora|anafe|calefacc|climatis|aires|termo|mate|juguera|exprimidor|cortadora/i, icon: "🏠" },
  { match: /impresora|sublimac|gigantograf|3d/i, icon: "🖨️" },
  { match: /conectividad|router|switch|red|cableado| telefonia|access ?point|extensor|señal/i, icon: "🌐" },
  { match: /seguridad|cctv|caja|alarma/i, icon: "🔒" },
  { match: /servidor|herramienta|calculadora/i, icon: "🛠️" },
  { match: /mochila|bolso/i, icon: "🎒" },
  { match: /monopatin/i, icon: "🛴" },
  { match: /mueble|silla/i, icon: "🪑" },
];

export function guessIcon(name: string): string {
  for (const hint of ICON_HINTS) if (hint.match.test(name)) return hint.icon;
  return "📦";
}
