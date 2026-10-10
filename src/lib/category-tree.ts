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

/**
 * Productos distintos por categoría, incluyendo los de sus descendientes.
 *
 * Cuenta ids y no suma conteos: un producto suele estar a la vez en la
 * categoría padre y en una subcategoría (el puente es N:N), y sumar lo contaba
 * dos veces (Aires Acondicionados mostraba 68 con 34 productos).
 */
export function countByCategory(
  nodes: CategoryNode[],
  productsByCategory: Map<number, number[]>,
): Map<number, number> {
  const out = new Map<number, number>();
  const walk = (node: CategoryNode): Set<number> => {
    const ids = new Set(productsByCategory.get(node.id) ?? []);
    for (const child of node.children) for (const id of walk(child)) ids.add(id);
    out.set(node.id, ids.size);
    return ids;
  };
  for (const root of nodes) walk(root);
  return out;
}

/**
 * Siglas y abreviaturas que se escriben en mayúsculas y no deben perderlas.
 *
 * La lista sale de los nombres que están de verdad en el catálogo, no de
 * suposiciones: sin esto, "CAMARAS CCTV" se transformaba en "Camaras Cctv" y
 * "Cables USB" en "Cables Usb", que son dos errores que el cliente ve enseguida.
 */
const SIGLAS = new Set([
  "3D", "AMD", "AP", "CCTV", "CPU", "GPU", "HDD", "HP", "IP", "LCD", "LED", "MSI", "PC", "RAM", "RCA", "SD", "SSD", "TV", "UPS", "USB", "WiFi",
]);

/** Marcas que llevan mayúscula interna y se capitalizan de otra manera. */
const MARCAS: Record<string, string> = {
  PLAYSTATION: "PlayStation",
  XBOX: "Xbox",
};

/**
 * Palabras a las que WooCommerce les borró el tilde al pasarlas a mayúsculas.
 *
 * El theme del cliente escribía todo en mayúsculas y sin tildes, así que
 * "CÁMARAS" llegó a la base como "CAMARAS" y "ELECTRODOMÉSTICOS" como
 * "ELECTRODOMESTICOS". El dato crudo no se toca (hay que devolverlo si algún
 * día se sincroniza con WordPress), así que la tilde se pone acá, en la capa
 * de lectura.
 *
 * La lista sale de las 128 filas reales del árbol, no de suposiciones: en el
 * catálogo quedan 10 nombres sin tilde de los que el cliente se dio cuenta
 * (6 con "CAMARAS", más "ELECTRODOMESTICOS", "ELECTRONICA", "CALEFACCION" y
 * "MONOPATINES ELECTRICOS"). Se incluyen también los singulares porque
 * WooCommerce alterna "CAMARA" y "CAMARAS" según cómo se creo la categoría.
 *
 * La clave está en mayúsculas sin tilde (lo que llega de WooCommerce) y el
 * valor en mayúsculas CON tilde: el tilde se resuelve antes del case, así que
 * "CAMARAS", "Camaras" y "Cámaras" terminan igual.
 */
const TILDES: Record<string, string> = {
  CAMARA: "CÁMARA",
  CAMARAS: "CÁMARAS",
  ELECTRICO: "ELÉCTRICO",
  ELECTRICAS: "ELÉCTRICAS",
  ELECTRICOS: "ELÉCTRICOS",
  ELECTRODOMESTICO: "ELECTRODOMÉSTICO",
  ELECTRODOMESTICOS: "ELECTRODOMÉSTICOS",
  CALEFACCION: "CALEFACCIÓN",
  ELECTRONICA: "ELECTRÓNICA",
};

/**
 * Nombres donde WooCommerce se comió una palabra, no solo el tilde.
 *
 * "CAMARAS DIGITALES FOTO" debería decir "Cámaras digitales y foto": es la
 * conjunción "y" del español la que falta en el nombre crudo, y el nombre de
 * la categoría es una frase, no una lista de palabras sueltas. En
 * el viejo catálogo demo esa misma categoría se llamaba "Cámaras y foto", así
 * que la intención del cliente está escrita; lo que se pierde es solo el "y".
 *
 * Se corrige por tokens, no por cadena completa, para que el nombre siga
 * pasando por el normalizador de mayúsculas y tildes como cualquier otro. Es
 * el único caso de las 128 filas: los otros 127 pierden, como mucho, la tilde.
 * Solo cambia el texto de la fila, nunca su slug.
 */
const PALABRAS_PERDIDAS: Record<string, string[]> = {
  "CAMARAS DIGITALES FOTO": ["CAMARAS", "DIGITALES", "Y", "FOTO"],
};

/** Une palabras ya capitalizadas respetando la conjunción "y" en minúscula. */
const CONECTORES = new Set(["Y", "De", "Del", "La", "El", "Los", "Las", "Para", "Con", "En", "Por", "Sin", "Al"]);

function joinWords(words: string[]): string {
  // Los conectores van en minúscula salvo que abran el nombre:
  // "Computadoras de Escritorio", "Notebooks para Oficina".
  return words
    .map((word, i) => (i > 0 && CONECTORES.has(word) ? word.toLowerCase() : word))
    .join(" ");
}

/** Capitaliza una palabra suelta, respetando siglas, marcas y tildes. */
function capitalizeWord(word: string): string {
  // Los signos pegados a la palabra se quedan donde están: "P/" -> "P/".
  // El corte cuenta cualquier letra, tilde incluida: si una palabra termina en
  // vocal acentuada ("CAFÉ") esa vocal es parte de la palabra, no un signo.
  const signo = word.match(/[^\p{L}\p{N}]+$/u)?.[0] ?? "";
  const base = signo ? word.slice(0, -signo.length) : word;
  if (!base) return word;

  const mayuscula = base.toUpperCase();
  if (SIGLAS.has(mayuscula)) return mayuscula + signo;
  if (MARCAS[mayuscula]) return MARCAS[mayuscula] + signo;
  // Con dígitos se respeta tal cual: "5G", "1080P", "iPhone".
  if (/\d/.test(base)) return base + signo;
  // El tilde va antes del case: WooCommerce lo mandó en mayúsculas sin tilde
  // ("CAMARAS") y el case es lo último que se arregla.
  const conTilde = TILDES[mayuscula] ?? base;
  return conTilde.charAt(0).toUpperCase() + conTilde.slice(1).toLowerCase() + signo;
}

/**
 * Pasa un nombre de categoría a capitalización normal con tildes correctas.
 *
 * WooCommerce guardó los nombres en mayúsculas ("ACCESORIOS P/ CELULARES",
 * "CAMARAS DIGITALES FOTO") porque era su convención de theme. En el backend
 * del cliente se ve bien, pero en la web queda como un grito. Se resuelve acá,
 * en la capa de lectura, y no en la base: el dato crudo se conserva para
 * sincronizar de vuelta con WordPress.
 *
 * Reglas:
 * - Las siglas y marcas se respetan: "CCTV", "USB", "PlayStation".
 * - Las tildes perdidas se recuperan antes del case: "CAMARAS" -> "Cámaras".
 * - Los signos pegados a la palabra se quedan donde están: "P/" -> "P/".
 * - Los guiones capitalizan cada parte: "ESTABILIZADORES- UPS".
 * - La conjunción "y" va en minúscula salvo que abra el nombre: "AUDIO Y VIDEO".
 * - Un token con dígito se respeta: "5G", "1080P".
 *
 * Solo se toca el texto de la fila: el slug y la ruta no pasan por acá, así que
 * las URLs quedan byte a byte iguales antes y después.
 */
export function titleCaseCategoryName(name: string): string {
  // La clave se busca en mayúsculas para que el arreglo sea idempotente: si
  // el nombre ya viene corregido ("Cámaras Digitales Foto") vuelve a salir
  // "Cámaras Digitales y Foto" y no "Cámaras Digitales Y Foto".
  const palabras = PALABRAS_PERDIDAS[name.toUpperCase()] ?? name.split(" ");
  return joinWords(
    palabras
      .filter((word) => word.length > 0)
      .map((word) => word.split("-").map(capitalizeWord).join("-")),
  );
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
