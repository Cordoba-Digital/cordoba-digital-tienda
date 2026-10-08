import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { categories, productCategories, products } from "@/db/schema";
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

/** Normaliza un nombre a slug URL: minúsculas, sin acentos, solo [a-z0-9-]. */
export function slugifyProductName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

async function uniqueProductSlug(base: string): Promise<string> {
  let slug = base;
  let suffix = 2;
  for (;;) {
    const [row] = await db.select({ slug: products.slug }).from(products).where(eq(products.slug, slug)).limit(1);
    if (!row) return slug;
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
}

export type AdminProductCreateInput = {
  name: string;
  brand: string;
  model?: string;
  storage?: string;
  ram?: string;
  condition?: string;
  isUnlocked?: boolean;
  price: number;
  compareAtPrice?: number | null;
  stock?: number;
  sku?: string;
  categorySlug: string;
  secondaryCategorySlugs?: string[];
  shortDescription?: string;
  description?: string;
  images?: string[];
  badge?: string | null;
  featured?: boolean;
  warrantyMonths?: number;
  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
};

export type CreateAdminProductResult =
  | { ok: true; slug: string }
  | { ok: false; error: string; status: 400 | 409 };

function isHttpUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\/\S+$/i.test(value.trim());
}

/**
 * Alta manual de producto (origen `manual`, protegido del prune de `migrate-wp`).
 * La descripción del form es texto plano: `descriptionHtml` queda vacío y
 * `imageSrcSets` son arrays vacíos por foto (la galería tolera srcsets vacíos
 * y pinta el `<img>` directo). Devuelve error legible en español o el slug.
 */
export async function createAdminProduct(raw: AdminProductCreateInput): Promise<CreateAdminProductResult> {
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) return { ok: false, error: "El nombre es obligatorio.", status: 400 };
  if (name.length > 200) return { ok: false, error: "El nombre no puede superar los 200 caracteres.", status: 400 };

  const brand = typeof raw.brand === "string" ? raw.brand.trim() : "";
  if (!brand) return { ok: false, error: "La marca es obligatoria.", status: 400 };

  if (!Number.isInteger(raw.price) || (raw.price as number) <= 0 || (raw.price as number) > 999_999_999) {
    return { ok: false, error: "El precio debe ser un entero mayor a 0.", status: 400 };
  }
  const compareAtPrice = raw.compareAtPrice ?? null;
  if (compareAtPrice !== null && (!Number.isInteger(compareAtPrice) || compareAtPrice <= 0)) {
    return { ok: false, error: "El precio anterior debe ser un entero mayor a 0 o estar vacío.", status: 400 };
  }
  const stock = raw.stock ?? 0;
  if (!Number.isInteger(stock) || stock < 0 || stock > 999_999) {
    return { ok: false, error: "El stock debe ser un entero entre 0 y 999999.", status: 400 };
  }

  const categorySlug = typeof raw.categorySlug === "string" ? raw.categorySlug.trim() : "";
  if (!categorySlug) return { ok: false, error: "Elegí una categoría principal.", status: 400 };

  const condition = typeof raw.condition === "string" && raw.condition ? raw.condition.trim() : "Nuevo";
  if (condition !== "Nuevo" && condition !== "Usado") {
    return { ok: false, error: "El estado debe ser Nuevo o Usado.", status: 400 };
  }
  const isUnlocked = raw.isUnlocked ?? true;
  if (typeof isUnlocked !== "boolean") {
    return { ok: false, error: "El campo liberado debe ser verdadero o falso.", status: 400 };
  }
  const featured = raw.featured ?? false;
  if (typeof featured !== "boolean") {
    return { ok: false, error: "El campo destacado debe ser verdadero o falso.", status: 400 };
  }
  const warrantyMonths = raw.warrantyMonths ?? 6;
  if (!Number.isInteger(warrantyMonths) || warrantyMonths < 0 || warrantyMonths > 60) {
    return { ok: false, error: "La garantía debe ser un entero entre 0 y 60 meses.", status: 400 };
  }

  const images = Array.isArray(raw.images) ? raw.images.map((u) => (typeof u === "string" ? u.trim() : "")) : [];
  if (images.length > 8) return { ok: false, error: "Podés agregar hasta 8 imágenes.", status: 400 };
  if (images.some((u) => !isHttpUrl(u))) {
    return { ok: false, error: "Cada imagen debe ser una URL http(s) válida.", status: 400 };
  }

  const allCategories = await db.select({ id: categories.id, slug: categories.slug }).from(categories);
  const bySlug = new Map(allCategories.map((c) => [c.slug, c.id]));
  const byId = new Map(allCategories.map((c) => [c.id, c.id]));
  const mainCategoryId = bySlug.get(categorySlug);
  if (!mainCategoryId) return { ok: false, error: "La categoría principal no existe.", status: 400 };

  const secondary = Array.isArray(raw.secondaryCategorySlugs) ? raw.secondaryCategorySlugs : [];
  const secondaryIds: number[] = [];
  for (const entry of secondary) {
    const token = typeof entry === "string" ? entry.trim() : "";
    if (!token) continue;
    const id = /^\d+$/.test(token) ? byId.get(Number(token)) : bySlug.get(token);
    if (!id) return { ok: false, error: "Una de las categorías secundarias no existe.", status: 400 };
    secondaryIds.push(id);
  }

  const base = slugifyProductName(name);
  if (!base) return { ok: false, error: "No se pudo generar un slug a partir del nombre.", status: 400 };
  const slug = await uniqueProductSlug(base);

  const badge = (typeof raw.badge === "string" ? raw.badge : "").trim().slice(0, 40) || null;
  const tags = Array.isArray(raw.tags)
    ? raw.tags.map((t) => (typeof t === "string" ? t.trim() : "")).filter(Boolean).map((t) => t.slice(0, 30)).slice(0, 20)
    : [];
  const seoTitle = typeof raw.seoTitle === "string" && raw.seoTitle.trim() ? raw.seoTitle.trim().slice(0, 200) : null;
  const seoDescription =
    typeof raw.seoDescription === "string" && raw.seoDescription.trim()
      ? raw.seoDescription.trim().slice(0, 300)
      : null;

  let productId: number;
  try {
    const [created] = await db
      .insert(products)
      .values({
        slug,
        sku: typeof raw.sku === "string" ? raw.sku.trim().slice(0, 100) : "",
        name,
        brand,
        categorySlug,
        shortDescription: typeof raw.shortDescription === "string" ? raw.shortDescription.trim() : "",
        description: typeof raw.description === "string" ? raw.description.trim() : "",
        // Texto plano por ahora: el form no edita HTML.
        descriptionHtml: "",
        price: raw.price,
        compareAtPrice,
        stock,
        images,
        // Sin variantes locales: un array vacío por foto, que la galería
        // (`srcSets[index] ?? []`) y `ProductImg` (`srcSet = []`) toleran.
        imageSrcSets: images.map(() => []),
        highlights: [],
        specs: [],
        tags,
        badge,
        featured,
        warrantyMonths,
        model: typeof raw.model === "string" ? raw.model.trim().slice(0, 100) : "",
        storage: typeof raw.storage === "string" ? raw.storage.trim().slice(0, 100) : "",
        ram: typeof raw.ram === "string" ? raw.ram.trim().slice(0, 100) : "",
        condition,
        isUnlocked,
        origin: "manual",
        updatedAt: new Date(),
        seoTitle,
        seoDescription,
      })
      .returning({ id: products.id });
    if (!created) return { ok: false, error: "No se pudo crear el producto.", status: 400 };
    productId = created.id;
  } catch (error) {
    // Carrera entre el chequeo de slug único y el insert: conflicto real.
    if ((error as { code?: string } | null)?.code === "23505") {
      return { ok: false, error: "Ya existe un producto con ese nombre.", status: 409 };
    }
    throw error;
  }

  const categoryIds = [...new Set([mainCategoryId, ...secondaryIds])];
  await db
    .insert(productCategories)
    .values(categoryIds.map((categoryId) => ({ productId, categoryId })))
    .onConflictDoNothing();

  return { ok: true, slug };
}
