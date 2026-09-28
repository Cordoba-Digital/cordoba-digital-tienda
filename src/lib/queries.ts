import { and, asc, desc, eq, gte, ilike, inArray, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db";
import { categories, coupons, orderItems, orders, productCategories, products, reviews } from "@/db/schema";
import {
  ancestorsOf,
  buildCategoryTree,
  countByCategory,
  findByPath,
  flattenTree,
  guessIcon,
  withDescendants,
  type CategoryNode,
  type CategoryRow,
} from "@/lib/category-tree";
import { ensureSeeded } from "@/lib/seed";

export type ProductFilters = {
  q?: string;
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
  freeShipping?: boolean;
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
  if (filters.category) clauses.push(eq(products.categorySlug, filters.category));
  if (subtree && (subtree.ids.length || subtree.slugs.length)) {
    // Puente N:N (categorías secundarias) + categoría principal, para que el
    // seed demo sin filas en el puente siga apareciendo.
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
  if (filters.freeShipping) clauses.push(eq(products.freeShipping, true));
  if (filters.inStock) clauses.push(gte(products.stock, 1));

  const valid = clauses.filter(Boolean) as SQL[];
  if (!valid.length) return undefined;
  return and(...valid);
}

function orderFor(sort?: string) {
  switch (sort) {
    case "precio-asc":
      return [asc(products.price)];
    case "precio-desc":
      return [desc(products.price)];
    case "descuento":
      return [desc(sql`coalesce(${products.compareAtPrice}, ${products.price}) - ${products.price}`)];
    case "vendidos":
      return [desc(products.soldCount)];
    case "puntaje":
      return [desc(products.rating), desc(products.reviewCount)];
    default:
      return [desc(products.featured), desc(products.soldCount)];
  }
}

export async function getCategories() {
  await ensureSeeded();
  return db.select().from(categories).orderBy(asc(categories.sortOrder));
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
/**
 * Árbol completo de categorías con el conteo de productos de cada subárbol.
 * Va envuelto en `cache()` de React: en un mismo render lo piden el layout, la
 * home y la página de categoría, y son 128 filas + un group by.
 */
export const getCategoryTree = cache(async (): Promise<CategoryTreeNode[]> => {
  await ensureSeeded();
  const rows = (await db.select().from(categories)) as CategoryRow[];
  const tree = buildCategoryTree(withGuessedIcons(rows));
  const direct = await db
    .select({ categoryId: productCategories.categoryId, count: sql<number>`count(*)::int` })
    .from(productCategories)
    .groupBy(productCategories.categoryId);
  const totals = countByCategory(
    tree,
    new Map(direct.map((r) => [r.categoryId, r.count])),
  );
  const attach = (nodes: CategoryNode[]): CategoryTreeNode[] =>
    nodes.map((node) => ({
      ...node,
      count: totals.get(node.id) ?? 0,
      children: attach(node.children),
    }));
  return attach(tree);
});

/** El migrador no trae íconos: los adivinamos por nombre cuando sigue el default. */
function withGuessedIcons(rows: CategoryRow[]): CategoryRow[] {
  return rows.map((row) => ({
    ...row,
    icon: !row.icon || row.icon === "📦" ? guessIcon(row.name) : row.icon,
  }));
}

/** Igual que getCategoryTree pero sin conteos (para el header, que no los usa). */
export async function getCategoryTreePlain(): Promise<CategoryNode[]> {
  await ensureSeeded();
  const rows = (await db.select().from(categories)) as CategoryRow[];
  return buildCategoryTree(withGuessedIcons(rows));
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

/** Ids + slugs de la categoría y todo su subárbol, para filtrar productos. */
async function subtreeOf(categoryId: number): Promise<{ ids: number[]; slugs: string[] }> {
  const tree = await getCategoryTree();
  const node = flattenTree(tree).find((n) => n.id === categoryId);
  if (!node) return { ids: [], slugs: [] };
  const nodes = withDescendants(node);
  return { ids: nodes.map((n) => n.id), slugs: nodes.map((n) => n.slug) };
}

/** Conteo por categoría raíz, incluyendo los productos de sus descendientes. */
export async function getCategoryCounts(): Promise<Map<string, number>> {
  const tree = await getCategoryTree();
  return new Map(tree.map((node) => [node.slug, node.count]));
}

export async function listProducts(filters: ProductFilters) {
  await ensureSeeded();
  const page = Math.max(1, filters.page ?? 1);
  const perPage = filters.perPage ?? 12;
  const subtree =
    filters.categoryId != null && filters.category == null ? await subtreeOf(filters.categoryId) : undefined;
  const where = buildWhere(filters, subtree);

  const items = await db
    .select()
    .from(products)
    .where(where)
    .orderBy(...orderFor(filters.sort))
    .limit(perPage)
    .offset((page - 1) * perPage);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(where);

  return {
    items,
    total: countRow?.count ?? 0,
    page,
    perPage,
    pages: Math.max(1, Math.ceil((countRow?.count ?? 0) / perPage)),
  };
}

export async function getBrandFacets(categoryId?: number) {
  await ensureSeeded();
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

export async function getFeaturedProducts(limit = 8) {
  await ensureSeeded();
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.featured, true), gte(products.stock, 1)))
    .orderBy(desc(products.soldCount))
    .limit(limit);
  if (rows.length) return rows;
  // El catálogo migrado de WooCommerce no trae `featured`: usamos lo más nuevo
  // con stock para que la home nunca quede vacía.
  return db.select().from(products).where(gte(products.stock, 1)).orderBy(desc(products.id)).limit(limit);
}

export async function getDealProducts(limit = 8) {
  await ensureSeeded();
  return db
    .select()
    .from(products)
    .where(and(sql`${products.compareAtPrice} is not null and ${products.compareAtPrice} > ${products.price}`, gte(products.stock, 1)))
    .orderBy(desc(sql`(coalesce(${products.compareAtPrice}, ${products.price}) - ${products.price})::float / coalesce(${products.compareAtPrice}, ${products.price})`))
    .limit(limit);
}

export async function getBestSellers(limit = 8) {
  await ensureSeeded();
  // `soldCount` viene en 0 desde WooCommerce: usamos los más cotizados como
  // aproximación honesta (productos con reseñas) y si no hay, los nuevos.
  const reviewed = await db
    .select()
    .from(products)
    .where(and(gte(products.stock, 1), gte(products.reviewCount, 1)))
    .orderBy(desc(products.reviewCount))
    .limit(limit);
  if (reviewed.length >= Math.min(4, limit)) return reviewed;
  return db.select().from(products).where(gte(products.stock, 1)).orderBy(desc(products.id)).limit(limit);
}

export async function getNewArrivals(limit = 8) {
  await ensureSeeded();
  return db.select().from(products).orderBy(desc(products.id)).limit(limit);
}

export async function getProductBySlug(slug: string) {
  await ensureSeeded();
  const [product] = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
  return product ?? null;
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
  const ids = await categoryIdsOfProduct(slug);
  const tree = await getCategoryTree();
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
  await ensureSeeded();
  return db.select().from(products).where(inArray(products.slug, slugs));
}

export async function getRelatedProducts(slug: string, categorySlug: string, limit = 4) {
  await ensureSeeded();
  return db
    .select()
    .from(products)
    .where(and(eq(products.categorySlug, categorySlug), ne(products.slug, slug)))
    .orderBy(desc(products.soldCount))
    .limit(limit);
}

export async function getReviewsForProduct(slug: string) {
  await ensureSeeded();
  return db
    .select()
    .from(reviews)
    .where(eq(reviews.productSlug, slug))
    .orderBy(desc(reviews.createdAt))
    .limit(12);
}

export async function getCoupon(code: string) {
  await ensureSeeded();
  const normalized = code.trim().toUpperCase();
  const [coupon] = await db.select().from(coupons).where(eq(coupons.code, normalized)).limit(1);
  if (!coupon || !coupon.active) return null;
  return coupon;
}

export async function getActiveCoupons() {
  await ensureSeeded();
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

export async function searchProducts(term: string, limit = 6) {
  await ensureSeeded();
  if (!term.trim()) return [];
  const pattern = `%${term.trim()}%`;
  return db
    .select({
      slug: products.slug,
      name: products.name,
      brand: products.brand,
      price: products.price,
      image: sql<string>`${products.images}->>0`,
      categorySlug: products.categorySlug,
    })
    .from(products)
    .where(
      or(
        ilike(products.name, pattern),
        ilike(products.brand, pattern),
        sql`${products.tags}::text ilike ${pattern}`,
      ),
    )
    .orderBy(desc(products.soldCount))
    .limit(limit);
}
