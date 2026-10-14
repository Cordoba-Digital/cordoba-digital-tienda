import { and, asc, desc, eq, gte, ilike, inArray, lte, ne, or, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { cache } from "react";

import { db } from "@/db";
import { categories, coupons, guides, orderItems, orders, productCategories, products, reviews } from "@/db/schema";
import { couponProblem, ensureCouponSchema } from "@/lib/coupons";
import {
  ancestorsOf,
  buildCategoryTree,
  countByCategory,
  findByPath,
  flattenTree,
  guessIcon,
  titleCaseCategoryName,
  withDescendants,
  type CategoryNode,
  type CategoryRow,
} from "@/lib/category-tree";
import { esMarcaDeRelleno } from "@/lib/brand-from-name";
import { normalizeSearch, stem, suggestCategories, understandQuery, type QueryUnderstanding } from "@/lib/query-understanding";
import { ttlCache } from "@/lib/ttl-cache";

export type ProductFilters = {
  q?: string;
  /** Palabras que tienen que estar todas (ver `understandQuery`). Se combinan con `q` si vienen los dos. */
  terms?: string[];
  /** Categoría principal (compatibilidad con el catálogo plano). */
  category?: string;
  /** Categoría por id: incluye el subárbol completo (categoría + descendientes). */
  categoryId?: number;
  brands?: string[];
  min?: number;
  max?: number;
  sort?: string;
  page?: number;
  perPage?: number;
  onlyOffers?: boolean;
  inStock?: boolean;
};

export const SORT_OPTIONS = [
  { id: "relevancia", label: "Más relevantes" },
  { id: "precio-asc", label: "Menor precio" },
  { id: "precio-desc", label: "Mayor precio" },
  { id: "descuento", label: "Mayor descuento" },
  { id: "vendidos", label: "Más vendidos" },
  { id: "puntaje", label: "Mejor puntaje" },
];

/** Columna en minúsculas y sin tildes, para comparar con lo que escribió el cliente. */
function plain(column: SQL | AnyPgColumn): SQL {
  return sql`translate(lower(${column}), 'áéíóúüàèìòùâêîôû', 'aeiouuaeiouaeiou')`;
}

/**
 * Una palabra de la búsqueda en nombre, marca, descripción corta, categoría o
 * etiquetas, sin tildes y en singular ("cámaras" encuentra "Cámara").
 */
function termMatch(term: string): SQL {
  const pattern = `%${stem(normalizeSearch(term))}%`;
  return or(
    sql`${plain(products.name)} like ${pattern}`,
    sql`${plain(products.brand)} like ${pattern}`,
    sql`${plain(products.shortDescription)} like ${pattern}`,
    sql`${plain(products.categorySlug)} like ${pattern}`,
    sql`${plain(sql`${products.tags}::text`)} like ${pattern}`,
  ) as SQL;
}

function buildWhere(filters: ProductFilters, subtree?: { ids: number[]; slugs: string[] }): SQL | undefined {
  const clauses: (SQL | undefined)[] = [];

  if (filters.q) {
    const term = `%${filters.q}%`;
    clauses.push(
      or(
        ilike(products.name, term),
        ilike(products.brand, term),
        ilike(products.shortDescription, term),
        ilike(products.categorySlug, term),
        sql`${products.tags}::text ilike ${term}`,
      ),
    );
  }
  for (const term of filters.terms ?? []) clauses.push(termMatch(term));
  if (filters.category) clauses.push(eq(products.categorySlug, filters.category));
  // Se pidió una categoría que no está en el árbol: no hay productos. Sin esto
  // el filtro quedaba vacío y se listaba el catálogo entero.
  if (subtree && !subtree.ids.length && !subtree.slugs.length) clauses.push(sql`false`);
  if (subtree && (subtree.ids.length || subtree.slugs.length)) {
    // Puente N:N (categorías secundarias) + categoría principal, para que el
    // producto sin filas en el puente siga apareciendo.
    const viaBridge = subtree.ids.length
      ? inArray(
          products.id,
          sql`(select product_id from product_categories where category_id in ${subtree.ids})`,
        )
      : undefined;
    const viaPrimary = subtree.slugs.length ? inArray(products.categorySlug, subtree.slugs) : undefined;
    const combined = viaBridge && viaPrimary ? or(viaBridge, viaPrimary) : (viaBridge ?? viaPrimary);
    if (combined) clauses.push(combined);
  }
  if (filters.brands?.length) clauses.push(inArray(products.brand, filters.brands));
  if (typeof filters.min === "number") clauses.push(gte(products.price, filters.min));
  if (typeof filters.max === "number") clauses.push(lte(products.price, filters.max));
  if (filters.onlyOffers) clauses.push(sql`${products.compareAtPrice} is not null and ${products.compareAtPrice} > ${products.price}`);
  if (filters.inStock) clauses.push(gte(products.stock, 1));

  const valid = clauses.filter(Boolean) as SQL[];
  if (!valid.length) return undefined;
  return and(...valid);
}

function orderFor(sort?: string) {
  // Empate determinista y "lo nuevo primero": WooCommerce no trae `featured`
  // (siempre false) ni `soldCount` (casi todo en 0), así que sin este
  // desempate los productos migrados más recientes caían en un orden
  // arbitrario y quedaban enterrados en las últimas páginas del catálogo.
  const newest = desc(products.createdAt);
  switch (sort) {
    case "precio-asc":
      return [asc(products.price), newest];
    case "precio-desc":
      return [desc(products.price), newest];
    case "descuento":
      return [desc(sql`coalesce(${products.compareAtPrice}, ${products.price}) - ${products.price}`), newest];
    case "vendidos":
      return [desc(products.soldCount), newest];
    case "puntaje":
      return [desc(products.rating), desc(products.reviewCount), newest];
    default:
      return [desc(products.featured), desc(products.soldCount), newest];
  }
}

export type CategoryTreeNode = Omit<CategoryNode, "children"> & {
  count: number;
  children: CategoryTreeNode[];
};

/**
 * Árbol completo de categorías con el conteo de productos de cada subárbol.
 * Se cachea por request porque el header, la home y las páginas de categoría
 * lo piden varias veces.
 */
/** Filas planas de categorías, cacheadas 5 min entre requests. */
const loadCategoryRows = ttlCache("category-rows", 5 * 60_000, () =>
  db.select().from(categories).then((rows) => rows as CategoryRow[]),
);

/** Ids de producto por categoría desde el puente, cacheado 5 min. */
const loadCategoryCounts = ttlCache("category-counts", 5 * 60_000, async () => {
  const rows = await db
    .select({ categoryId: productCategories.categoryId, productIds: sql<number[]>`array_agg(${productCategories.productId})` })
    .from(productCategories)
    .groupBy(productCategories.categoryId);
  return new Map(rows.map((r) => [r.categoryId, r.productIds]));
});

/**
 * Árbol completo de categorías con el conteo de productos de cada subárbol.
 *
 * El layout lo pide en todas las páginas y el header lo necesita, así que va
 * cacheado 5 minutos: solo cambia cuando se re-migra el catálogo. `cache()` de
 * React deduplica además dentro de un mismo render.
 */
export const getCategoryTree = cache(async (): Promise<CategoryTreeNode[]> => {
  const [rows, direct] = await Promise.all([loadCategoryRows(), loadCategoryCounts()]);
  const tree = buildCategoryTree(withDisplayNames(withGuessedIcons(rows)));
  const totals = countByCategory(tree, direct);
  const attach = (nodes: CategoryNode[]): CategoryTreeNode[] =>
    nodes.map((node) => ({
      ...node,
      count: totals.get(node.id) ?? 0,
      children: attach(node.children),
    }));
  return attach(tree);
});

/**
 * El migrador no trae íconos: los adivinamos por nombre cuando sigue el default.
 *
 * Se hace antes de `withDisplayNames` a propósito, porque los patrones de
 * `guessIcon` están escritos contra los nombres en mayúsculas de WooCommerce.
 */
function withGuessedIcons(rows: CategoryRow[]): CategoryRow[] {
  return rows.map((row) => ({
    ...row,
    icon: !row.icon || row.icon === "📦" ? guessIcon(row.name) : row.icon,
  }));
}

/**
 * Normaliza el nombre para mostrarlo: WooCommerce los trae en mayúsculas
 * ("ACCESORIOS P/ CELULARES") y en la web se leen como un grito.
 *
 * Se aplica acá y no en la base a propósito. Casi toda la navegación sale de
 * `getCategoryTree` — el header, el footer, la home, los filtros, las páginas de
 * categoría y los breadcrumbs del producto — así que un solo paso los cubre a
 * todos y no hay que acordarse de hacerlo en cada componente. La base guarda el
 * nombre crudo, que es el que hay que devolver si algún día se sincroniza con
 * WordPress.
 */
function withDisplayNames(rows: CategoryRow[]): CategoryRow[] {
  return rows.map((row) => ({ ...row, name: titleCaseCategoryName(row.name) }));
}

export type CategoryPageData = {
  node: CategoryTreeNode;
  ancestors: CategoryNode[];
  children: CategoryTreeNode[];
  breadcrumb: { name: string; path: string }[];
};

/** Resuelve una ruta `/categoria/a/b/c` a su categoría, ancestros e hijos. */
export async function getCategoryByPath(segments: string[]): Promise<CategoryPageData | null> {
  const tree = await getCategoryTree();
  const flat = flattenTree(tree);
  const node = findByPath(tree, segments);
  if (!node) return null;
  const byId = new Map(flat.map((n) => [n.id, n]));
  const ancestors = ancestorsOf(node, byId);
  return {
    node,
    ancestors,
    children: node.children,
    breadcrumb: [...ancestors, node].map((n) => ({ name: n.name, path: n.path })),
  };
}

/** Rutas completas de todas las categorías (para sitemap y menús). */
export async function getCategoryPaths(): Promise<{ path: string; name: string; count: number; depth: number }[]> {
  const tree = await getCategoryTree();
  return flattenTree(tree).map((n) => ({ path: n.path, name: n.name, count: n.count, depth: n.depth }));
}

/** Lo que se muestra de una guía sin el cuerpo: para el pie y los enlazados. */
export type GuideTeaser = {
  slug: string;
  title: string;
  subtitle: string;
};

/**
 * Guías de compra, en el orden en que las lista el pie del sitio original.
 *
 * Solo trae lo liviano: el cuerpo son miles de palabras y el pie se renderiza en
 * todas las páginas, así que no puede ir el artículo entero.
 */
export const getGuides = cache(async (): Promise<GuideTeaser[]> => {
  const rows = await db
    .select({ slug: guides.slug, title: guides.title, subtitle: guides.subtitle })
    .from(guides)
    .orderBy(asc(guides.footerOrder), asc(guides.id));
  return rows;
});

/** Una guía por slug, o null si no existe. La página 404 con eso. */
export const getGuideBySlug = cache(async (slug: string) => {
  const [row] = await db.select().from(guides).where(eq(guides.slug, slug)).limit(1);
  return row ?? null;
});

/** Lo que necesita la ficha del índice de guías, sin el cuerpo del artículo. */
export type GuideCard = GuideTeaser & {
  description: string;
  wordCount: number;
  updatedAt: Date;
  meta: {
    etiqueta?: string;
    actualizacion?: string;
    cobertura?: string;
    categoria?: string;
  };
};

/**
 * Guías con los datos de la tarjeta, para el índice `/guias`.
 *
 * Va aparte de `getGuides` a propósito: esa se usa en el pie, que se renderiza en
 * todas las páginas del sitio, y traer la metadata de las guías ahí suma una
 * lectura de más en cada request sin que se use.
 */
export const getGuideCards = cache(async (): Promise<GuideCard[]> => {
  return db
    .select({
      slug: guides.slug,
      title: guides.title,
      subtitle: guides.subtitle,
      description: guides.description,
      wordCount: guides.wordCount,
      updatedAt: guides.updatedAt,
      meta: guides.meta,
    })
    .from(guides)
    .orderBy(asc(guides.footerOrder), asc(guides.id));
});

/** Ids + slugs de la categoría y todo su subárbol, para filtrar productos. */
async function subtreeOf(categoryId: number): Promise<{ ids: number[]; slugs: string[] }> {
  const tree = await getCategoryTree();
  const node = flattenTree(tree).find((n) => n.id === categoryId);
  if (!node) return { ids: [], slugs: [] };
  const nodes = withDescendants(node);
  return { ids: nodes.map((n) => n.id), slugs: nodes.map((n) => n.slug) };
}

export async function listProducts(filters: ProductFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = filters.perPage ?? 12;
  const subtree =
    filters.categoryId != null && filters.category == null ? await subtreeOf(filters.categoryId) : undefined;
  const where = buildWhere(filters, subtree);

  // Proyección explícita a columnas de tarjeta: el `select()` entero traía
  // `descriptionHtml`, `specs` y SEO por cada una de las 24 filas, peso que
  // viaja DB→server aunque la tarjeta solo usa `toView` (ver `CardRow`).
  const cardColumns = {
    slug: products.slug,
    name: products.name,
    brand: products.brand,
    categorySlug: products.categorySlug,
    shortDescription: products.shortDescription,
    price: products.price,
    compareAtPrice: products.compareAtPrice,
    stock: products.stock,
    rating: products.rating,
    reviewCount: products.reviewCount,
    soldCount: products.soldCount,
    images: products.images,
    imageSrcSets: products.imageSrcSets,
    badge: products.badge,
    freeShipping: products.freeShipping,
    highlights: products.highlights,
  };

  // Items y conteo en paralelo: son dos round-trips independientes con el
  // mismo `where`, y esta consulta corre en /productos, /categoria y
  // /favoritos, o sea en casi todo el tráfico del sitio.
  const [items, [countRow]] = await Promise.all([
    db
      .select(cardColumns)
      .from(products)
      .where(where)
      .orderBy(...orderFor(filters.sort))
      .limit(perPage)
      .offset((page - 1) * perPage),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(where),
  ]);

  return {
    items,
    total: countRow?.count ?? 0,
    page,
    perPage,
    pages: Math.max(1, Math.ceil((countRow?.count ?? 0) / perPage)),
  };
}

export async function getBrandFacets(categoryId?: number) {
  if (categoryId == null) {
    return db
      .select({ brand: products.brand, count: sql<number>`count(*)::int` })
      .from(products)
      .groupBy(products.brand)
      .orderBy(asc(products.brand));
  }
  const subtree = await subtreeOf(categoryId);
  const where = buildWhere({}, subtree);
  return db
    .select({ brand: products.brand, count: sql<number>`count(*)::int` })
    .from(products)
    .where(where)
    .groupBy(products.brand)
    .orderBy(asc(products.brand));
}

/**
 * Rango de precios y stock de una categoría con su subárbol, para las
 * preguntas frecuentes de la página (ver lib/category-seo.ts). Los productos
 * sin precio cargado no cuentan para el rango.
 */
export async function getCategoryPriceStats(categoryId: number) {
  const subtree = await subtreeOf(categoryId);
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      inStock: sql<number>`count(*) filter (where ${products.stock} > 0)::int`,
      minPrice: sql<number | null>`min(${products.price}) filter (where ${products.price} > 0)`,
      maxPrice: sql<number | null>`max(${products.price}) filter (where ${products.price} > 0)`,
    })
    .from(products)
    .where(buildWhere({}, subtree));
  return {
    total: row?.total ?? 0,
    inStock: row?.inStock ?? 0,
    // `Number` por si el driver devuelve el agregado como string.
    minPrice: row?.minPrice == null ? null : Number(row.minPrice),
    maxPrice: row?.maxPrice == null ? null : Number(row.maxPrice),
  };
}

export async function getFeaturedProducts(limit = 8) {
  // El catálogo migrado de WooCommerce no trae `featured` (todo false) ni
  // `soldCount` (todo 0). Ordenar por soldCount las enterraba detrás del
  // catálogo viejo: acá van primero los más nuevos con stock (createdAt, y
  // `id` como desempate determinista), que es donde caen las tandas recién
  // migradas de www.cordobadigital.net. El flag `featured` solo desempata.
  const rows = await db
    .select()
    .from(products)
    .where(gte(products.stock, 1))
    .orderBy(desc(products.createdAt), desc(products.featured), desc(products.id))
    .limit(limit);
  return rows;
}

export async function getDealProducts(limit = 8) {
  return db
    .select()
    .from(products)
    .where(and(sql`${products.compareAtPrice} is not null and ${products.compareAtPrice} > ${products.price}`, gte(products.stock, 1)))
    .orderBy(desc(sql`(coalesce(${products.compareAtPrice}, ${products.price}) - ${products.price})::float / coalesce(${products.compareAtPrice}, ${products.price})`))
    .limit(limit);
}

/** Total de productos del catálogo, cacheado 5 min. */
export const getProductCount = ttlCache("product-count", 5 * 60_000, async () => {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(products);
  return row?.count ?? 0;
});

export async function getBestSellers(limit = 8) {
  // `soldCount` viene en 0 desde WooCommerce: usamos los más cotizados como
  // aproximación honesta (productos con reseñas) y si no hay, los nuevos.
  const reviewed = await db
    .select()
    .from(products)
    .where(and(gte(products.stock, 1), gte(products.reviewCount, 1)))
    .orderBy(desc(products.reviewCount))
    .limit(limit);
  if (reviewed.length >= Math.min(4, limit)) return reviewed;
  // Fallback: los más nuevos con stock (ids altos / createdAt reciente), que
  // es donde están los migrados de www.cordobadigital.net.
  return db.select().from(products).where(gte(products.stock, 1)).orderBy(desc(products.createdAt), desc(products.id)).limit(limit);
}

export async function getNewArrivals(limit = 8) {
  return db.select().from(products).orderBy(desc(products.createdAt), desc(products.id)).limit(limit);
}

/** Por slug, con `cache()` de React: `generateMetadata` y la página llaman a
    `findProduct()` en el mismo request (hasta 5 lookups por los slugs con
    `%`-encoding) y sin esto cada uno pegaba a la base. */
export const getProductBySlug = cache(async (slug: string) => {
  const [product] = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
  return product ?? null;
});

function safeDecodeSlug(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Resuelve un slug contra el catálogo probando sus variantes de encoding.
 * El migrador dejó slugs con `%e2%80%b3` literal pegado en el texto, y según
 * la ruta Next entrega el segmento crudo o ya decodificado: se prueban crudo,
 * decodificado y re-codificados (hex en ambas cajas). Misma estrategia que la
 * ficha pública (`producto/[slug]`); la usa también el PATCH del admin.
 */
export async function findProductBySlug(slug: string) {
  const seen = new Set<string>([slug]);
  const decoded = safeDecodeSlug(slug);
  if (decoded !== slug) seen.add(decoded);
  for (const base of [...seen]) {
    const encoded = encodeURIComponent(base);
    seen.add(encoded);
    seen.add(encoded.replace(/%[0-9A-F]{2}/g, (m) => m.toLowerCase()));
  }
  for (const candidate of seen) {
    const [product] = await db.select().from(products).where(eq(products.slug, candidate)).limit(1);
    if (product) return product;
  }
  return null;
}

/** Ids de todas las categorías asignadas a un producto. */
async function categoryIdsOfProduct(slug: string): Promise<number[]> {
  const rows = await db
    .select({ categoryId: productCategories.categoryId })
    .from(productCategories)
    .innerJoin(products, eq(products.id, productCategories.productId))
    .where(eq(products.slug, slug));
  return [...new Set(rows.map((r) => r.categoryId))];
}

/** Cadenas de breadcrumbs (raíz → … → categoría) de un producto. */
export async function getProductBreadcrumbs(slug: string): Promise<{ name: string; path: string }[]> {
  const [ids, tree] = await Promise.all([categoryIdsOfProduct(slug), getCategoryTree()]);
  const flat = flattenTree(tree);
  const byId = new Map(flat.map((n) => [n.id, n]));
  const chains = ids
    .map((id) => byId.get(id))
    .filter((n): n is CategoryTreeNode => Boolean(n))
    .map((n) => [...ancestorsOf(n, byId), n]);
  if (!chains.length) return [];
  // Breadcrumb de la categoría más específica (la más profunda).
  return chains.sort((a, b) => b.length - a.length)[0].map((n) => ({ name: n.name, path: n.path }));
}

export async function getProductsBySlugs(slugs: string[]) {
  if (!slugs.length) return [];
  return db.select().from(products).where(inArray(products.slug, slugs));
}

export async function getRelatedProducts(slug: string, categorySlug: string, limit = 4) {
  return db
    .select()
    .from(products)
    .where(and(eq(products.categorySlug, categorySlug), ne(products.slug, slug)))
    .orderBy(desc(products.soldCount))
    .limit(limit);
}

export async function getReviewsForProduct(slug: string) {
  return db
    .select({
      id: reviews.id,
      author: reviews.author,
      rating: reviews.rating,
      title: reviews.title,
      body: reviews.body,
      verified: reviews.verified,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .where(eq(reviews.productSlug, slug))
    .orderBy(desc(reviews.createdAt))
    .limit(12);
}

/**
 * Promedio y distribución de las reseñas verificadas (compra con pedido pago).
 * Es lo único que alimenta el resumen de estrellas y el AggregateRating del
 * JSON-LD: no se usan `products.rating`/`reviewCount`, que pueden traer valores
 * del catálogo semilla o reseñas sin compra.
 */
export async function getVerifiedRatingStats(slug: string) {
  const rows = await db
    .select({ rating: reviews.rating, count: sql<number>`count(*)::int` })
    .from(reviews)
    .where(and(eq(reviews.productSlug, slug), eq(reviews.verified, true)))
    .groupBy(reviews.rating);
  const distribution: Record<number, number> = {};
  let count = 0;
  let sum = 0;
  for (const row of rows) {
    distribution[row.rating] = row.count;
    count += row.count;
    sum += row.rating * row.count;
  }
  // rating * 10, igual que `products.rating`.
  const rating = count ? Math.round((sum / count) * 10) : 0;
  return { count, rating, distribution };
}

/** El cupón si hoy se puede usar: activo, sin vencer y con usos disponibles. */
export async function getCoupon(code: string) {
  const normalized = code.trim().toUpperCase();
  await ensureCouponSchema();
  const [coupon] = await db.select().from(coupons).where(eq(coupons.code, normalized)).limit(1);
  if (!coupon || couponProblem(coupon)) return null;
  return coupon;
}

export async function getActiveCoupons() {
  return db.select().from(coupons).where(eq(coupons.active, true));
}

export async function getOrderByCode(code: string, email?: string) {
  const normalized = code.trim().toUpperCase();
  const [order] = await db.select().from(orders).where(eq(orders.code, normalized)).limit(1);
  if (!order) return null;
  if (email && order.email.toLowerCase() !== email.trim().toLowerCase()) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  return { order, items };
}

/**
 * Historial de un cliente: matchea por email en minúsculas, así incluye los
 * pedidos hechos como invitado antes de registrarse. Ordenados nuevos primero.
 */
export async function getOrdersByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return [];
  const rows = await db
    .select({
      id: orders.id,
      code: orders.code,
      status: orders.status,
      customerName: orders.customerName,
      paymentLabel: orders.paymentLabel,
      deliveryLabel: orders.deliveryLabel,
      total: orders.total,
      trackingCode: orders.trackingCode,
      createdAt: orders.createdAt,
    })
    .from(orders)
    // `lower()` para usar `orders_email_lower_idx` y encontrar pedidos viejos guardados con mayúsculas.
    .where(sql`lower(${orders.email}) = ${normalized}`)
    .orderBy(desc(orders.createdAt));
  if (!rows.length) return [];
  const counts = await db
    .select({ orderId: orderItems.orderId, count: sql<number>`count(*)::int` })
    .from(orderItems)
    .where(
      sql`${orderItems.orderId} in (${sql.join(
        rows.map((r) => sql`${r.id}`),
        sql`, `,
      )})`,
    )
    .groupBy(orderItems.orderId);
  const byOrder = new Map(counts.map((r) => [r.orderId, r.count]));
  return rows.map((r) => ({ ...r, itemsCount: byOrder.get(r.id) ?? 0 }));
}

/** Lo que entiende el buscador de una búsqueda: categoría y marca nombradas, y categorías que sugiere. */
async function analyzeSearch(q: string) {
  const loaded = await loadQueryCatalog();
  const catalog = { categories: loaded.categories, brands: loaded.brands.map((b) => b.brand).filter(Boolean) };
  const understood = understandQuery(q, catalog);
  const suggested = suggestCategories(q, catalog);
  return { loaded, catalog, understood, suggested };
}

export async function searchProducts(term: string, limit = 6) {
  const words = normalizeSearch(term).split(" ").filter(Boolean);
  if (!words.length) return [];
  const { understood, suggested } = await analyzeSearch(term);

  // Dónde está lo que se busca: la categoría nombrada o, si no se nombró
  // ninguna, las que sugiere el desplegable ("camaras" → Cámaras Digitales,
  // Cámaras CCTV). Lo de ahí va primero aunque otro producto mencione la
  // palabra en la descripción (los celulares dicen "cámara").
  // Lo de la primera suma más que lo de las demás: en "celulares", Celulares
  // Liberados pesa más que Accesorios P/ Celulares.
  const focusIds = understood.category ? [understood.category.id] : suggested.map((c) => c.id);
  const focus = await Promise.all(focusIds.map(subtreeOf));

  // Relevancia: cada palabra que está en el nombre suma 3 ("Aire Acondicionado"
  // antes que "Caloventor" dentro de Aires Acondicionados) y estar en la
  // categoría buscada suma 5, o 2 en las otras sugeridas (el parlante de
  // Accesorios P/ Celulares queda debajo de los celulares). Después, lo más vendido.
  const nameWords = words.filter((w) => w.length > 2).map(stem);
  const parts: SQL[] = nameWords.map((w) => sql`(case when ${plain(products.name)} like ${`%${w}%`} then 3 else 0 end)`);
  focus.forEach((t, i) => {
    if (t.slugs.length) parts.push(sql`(case when ${inArray(products.categorySlug, t.slugs)} then ${i === 0 ? 5 : 2} else 0 end)`);
  });
  const score = parts.length ? sql.join(parts, sql` + `) : sql`0`;

  const run = (where: SQL | undefined) =>
    db
      .select({
        slug: products.slug,
        name: products.name,
        brand: products.brand,
        price: products.price,
        image: sql<string>`${products.images}->>0`,
        categorySlug: products.categorySlug,
      })
      .from(products)
      .where(where)
      .orderBy(desc(score), desc(products.soldCount))
      .limit(limit);

  // Como en /productos: si nombra categoría o marca, se busca ahí adentro
  // ("celular samsung" no trae la funda Samsung de Accesorios).
  if (understood.category || understood.brand) {
    const subtree = understood.category ? await subtreeOf(understood.category.id) : undefined;
    const rows = await run(buildWhere({ terms: understood.terms, brands: understood.brand ? [understood.brand] : [] }, subtree));
    if (rows.length) return rows;
  }
  // Cada palabra en cualquier campo: "celular samsung" encuentra "Samsung Galaxy A55" de Celulares.
  return run(and(...words.map(termMatch)));
}

export type SearchShortcut = { label: string; href: string; count: number };

/**
 * Atajos del desplegable del buscador además de los productos: "celular" sugiere
 * Celulares y sus marcas (Celulares Samsung, Celulares Apple...), y "samsung"
 * sugiere todo Samsung. Llevan a la categoría o al catálogo ya filtrados.
 */
export async function searchShortcuts(q: string, limit = 6): Promise<SearchShortcut[]> {
  const { loaded, catalog, understood, suggested } = await analyzeSearch(q);
  const brandRows = loaded.brands;
  const main = understood.category
    ? catalog.categories.find((c) => c.id === understood.category!.id) ?? suggested[0]
    : suggested[0];

  const out: SearchShortcut[] = [];
  let brandsShown: string[] = [];
  if (main) {
    // Las subcategorías por marca se llaman como la marca ("Samsung" dentro de
    // Celulares): se muestran como "Celulares Samsung".
    const isBrand = (name: string) => catalog.brands.some((b) => normalizeSearch(b) === normalizeSearch(name));
    const parent = main.parentId != null ? catalog.categories.find((c) => c.id === main.parentId) : undefined;
    const label = parent && isBrand(main.name) ? `${parent.name} ${main.name}` : main.name;
    out.push({ label, href: `/categoria/${main.path}`, count: main.count });
    // Las marcas que más hay dentro de la categoría; si se nombró una, solo esa.
    const inside = (await getBrandFacets(main.id))
      .filter((b) => b.brand && (!understood.brand || b.brand === understood.brand))
      // Las de relleno no ayudan como atajo ("Cámaras General").
      .filter((b) => !esMarcaDeRelleno(b.brand))
      .filter((b) => normalizeSearch(b.brand) !== normalizeSearch(main.name))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    for (const b of inside) {
      out.push({ label: `${main.name} ${b.brand}`, href: `/categoria/${main.path}?marca=${encodeURIComponent(b.brand)}`, count: b.count });
    }
    brandsShown = inside.map((b) => normalizeSearch(b.brand));
  } else if (understood.brand) {
    const count = brandRows.find((b) => b.brand === understood.brand)?.count ?? 0;
    out.push({ label: `Todo ${understood.brand}`, href: `/productos?marca=${encodeURIComponent(understood.brand)}`, count });
  }
  const byId = new Map(catalog.categories.map((c) => [c.id, c]));
  const insideMain = (id: number) => {
    for (let p = byId.get(id)?.parentId ?? null; p != null; p = byId.get(p)?.parentId ?? null) if (p === main?.id) return true;
    return false;
  };
  for (const c of suggested) {
    if (c.id === main?.id) continue;
    // "Celulares Xiaomi" (subcategoría) repetiría el atajo "Celulares Liberados Xiaomi".
    if (insideMain(c.id) && brandsShown.some((b) => ` ${normalizeSearch(c.name)} `.includes(` ${b} `))) continue;
    out.push({ label: c.name, href: `/categoria/${c.path}`, count: c.count });
  }
  return out.slice(0, limit);
}

/**
 * Qué categoría y marca nombra una búsqueda del catálogo (ver
 * `query-understanding.ts`). Usa el árbol y las marcas que ya están en caché.
 */
export async function understandCatalogQuery(q: string): Promise<QueryUnderstanding> {
  const { categories, brands } = await loadQueryCatalog();
  return understandQuery(q, { categories, brands: brands.map((b) => b.brand).filter(Boolean) });
}

/** Categorías y marcas del catálogo en el formato de `query-understanding.ts`. */
async function loadQueryCatalog() {
  const [tree, brands] = await Promise.all([getCategoryTree(), getBrandFacets()]);
  return {
    categories: flattenTree(tree).map((c) => ({ id: c.id, name: c.name, path: c.path, depth: c.depth, parentId: c.parentId, count: c.count })),
    brands: brands.map((b) => ({ brand: b.brand, count: b.count })),
  };
}
