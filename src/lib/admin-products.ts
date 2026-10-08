import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { findProductBySlug } from "@/lib/queries";

export type AdminProductRow = {
  slug: string;
  sku: string;
  name: string;
  brand: string;
  categorySlug: string;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  badge: string | null;
  featured: boolean;
  image: string;
};

export async function listAdminProducts(input: {
  q: string;
  category: string;
  sinStock: boolean;
  oferta: boolean;
  destacados: boolean;
  page: number;
  perPage: number;
}): Promise<{ items: AdminProductRow[]; total: number; page: number; perPage: number; pages: number }> {
  const q = input.q.trim();
  const category = input.category.trim();
  const page = Math.max(1, input.page || 1);
  const perPage = Math.min(50, Math.max(1, input.perPage || 20));

  const clauses = [];
  if (q) {
    const term = `%${q}%`;
    clauses.push(or(ilike(products.name, term), ilike(products.sku, term), ilike(products.brand, term)));
  }
  if (category) clauses.push(eq(products.categorySlug, category));
  if (input.sinStock) clauses.push(sql`${products.stock} <= 0`);
  if (input.oferta) clauses.push(sql`${products.compareAtPrice} is not null and ${products.compareAtPrice} > ${products.price}`);
  if (input.destacados) clauses.push(eq(products.featured, true));
  const where = clauses.length ? and(...clauses) : undefined;

  const [rows, [countRow]] = await Promise.all([
    db
      .select({
        slug: products.slug,
        sku: products.sku,
        name: products.name,
        brand: products.brand,
        categorySlug: products.categorySlug,
        price: products.price,
        compareAtPrice: products.compareAtPrice,
        stock: products.stock,
        badge: products.badge,
        featured: products.featured,
        image: sql<string>`${products.images}->>0`,
      })
      .from(products)
      .where(where)
      .orderBy(desc(products.createdAt))
      .limit(perPage)
      .offset((page - 1) * perPage),
    db.select({ count: sql<number>`count(*)::int` }).from(products).where(where),
  ]);

  const total = countRow?.count ?? 0;
  return { items: rows, total, page, perPage, pages: Math.max(1, Math.ceil(total / perPage)) };
}

export async function listProductCategories(): Promise<{ slug: string; name: string }[]> {
  return db
    .select({ slug: categories.slug, name: categories.name })
    .from(categories)
    .orderBy(categories.name);
}

export type ProductPatch = {
  price?: number;
  stock?: number;
  featured?: boolean;
  badge?: string | null;
};

/** Valida y aplica cambios operativos. Devuelve error legible o null si ok. */
export async function updateAdminProduct(slug: string, patch: ProductPatch): Promise<string | null> {
  const set: Partial<typeof products.$inferInsert> = {};
  if (patch.price !== undefined) {
    if (!Number.isInteger(patch.price) || patch.price <= 0 || patch.price > 999_999_999) {
      return "El precio debe ser un entero mayor a 0.";
    }
    set.price = patch.price;
  }
  if (patch.stock !== undefined) {
    if (!Number.isInteger(patch.stock) || patch.stock < 0 || patch.stock > 999_999) {
      return "El stock debe ser un entero entre 0 y 999999.";
    }
    set.stock = patch.stock;
  }
  if (patch.featured !== undefined) set.featured = patch.featured;
  if (patch.badge !== undefined) {
    const badge = (patch.badge ?? "").trim().slice(0, 40) || null;
    set.badge = badge;
  }
  if (Object.keys(set).length === 0) return "Nada para actualizar.";
  // Los slugs con `%` literal (restos de la migración) llegan crudos o
  // decodificados según la ruta: se resuelven con las variantes de encoding.
  const existing = await findProductBySlug(slug);
  if (!existing) return "Producto inexistente.";
  await db.update(products).set(set).where(eq(products.slug, existing.slug));
  return null;
}
