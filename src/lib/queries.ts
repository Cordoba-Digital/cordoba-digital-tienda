import { and, asc, desc, eq, gte, ilike, inArray, lte, ne, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { categories, coupons, orderItems, orders, products, reviews } from "@/db/schema";
import { ensureSeeded } from "@/lib/seed";

export type ProductFilters = {
  q?: string;
  category?: string;
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

function buildWhere(filters: ProductFilters): SQL | undefined {
  const clauses: (SQL | undefined)[] = [];

  if (filters.q) {
    const term = `%${filters.q}%`;
    clauses.push(
      or(
        ilike(products.name, term),
        ilike(products.brand, term),
        ilike(products.shortDescription, term),
        ilike(products.categorySlug, term),
      ),
    );
  }
  if (filters.category) clauses.push(eq(products.categorySlug, filters.category));
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

export async function getCategoryCounts() {
  await ensureSeeded();
  const rows = await db
    .select({ categorySlug: products.categorySlug, count: sql<number>`count(*)::int` })
    .from(products)
    .groupBy(products.categorySlug);
  return new Map(rows.map((r) => [r.categorySlug, r.count]));
}

export async function listProducts(filters: ProductFilters) {
  await ensureSeeded();
  const page = Math.max(1, filters.page ?? 1);
  const perPage = filters.perPage ?? 12;
  const where = buildWhere(filters);

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

export async function getBrandFacets(category?: string) {
  await ensureSeeded();
  const rows = await db
    .select({ brand: products.brand, count: sql<number>`count(*)::int` })
    .from(products)
    .where(category ? eq(products.categorySlug, category) : undefined)
    .groupBy(products.brand)
    .orderBy(asc(products.brand));
  return rows;
}

export async function getFeaturedProducts(limit = 8) {
  await ensureSeeded();
  return db
    .select()
    .from(products)
    .where(eq(products.featured, true))
    .orderBy(desc(products.soldCount))
    .limit(limit);
}

export async function getDealProducts(limit = 8) {
  await ensureSeeded();
  return db
    .select()
    .from(products)
    .where(sql`${products.compareAtPrice} is not null and ${products.compareAtPrice} > ${products.price}`)
    .orderBy(desc(sql`(coalesce(${products.compareAtPrice}, ${products.price}) - ${products.price})::float / coalesce(${products.compareAtPrice}, ${products.price})`))
    .limit(limit);
}

export async function getBestSellers(limit = 8) {
  await ensureSeeded();
  return db.select().from(products).orderBy(desc(products.soldCount)).limit(limit);
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
