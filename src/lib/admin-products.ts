import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { categories, productCategories, products, type Spec } from "@/db/schema";
import { findProductBySlug } from "@/lib/queries";
import { sanitizeHtml } from "@/lib/sanitize-html";

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
  if (category) {
    // Cualquier producto asignado a la categoría o a una subcategoría, sea
    // principal o secundaria: casi todo el catálogo está en más de una.
    clauses.push(sql`(${products.categorySlug} = ${category} or exists (
      select 1 from product_categories pc
      where pc.product_id = ${products.id}
        and pc.category_id in (
          with recursive tree as (
            select id from categories where slug = ${category}
            union all
            select c.id from categories c join tree on c.parent_id = tree.id
          )
          select id from tree
        )
    ))`);
  }
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
  /** Solo en edición: HTML de la descripción migrada de WooCommerce. Se sanea. */
  descriptionHtml?: string;
  images?: string[];
  badge?: string | null;
  featured?: boolean;
  warrantyMonths?: number;
  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
  weight?: string;
  dimensions?: string;
  highlights?: string[];
  specs?: Spec[];
};

export type CreateAdminProductResult =
  | { ok: true; slug: string }
  | { ok: false; error: string; status: 400 | 404 | 409 };

function isHttpUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\/\S+$/i.test(value.trim());
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

type NormalizedProduct = {
  values: Omit<typeof products.$inferInsert, "slug" | "origin" | "descriptionHtml" | "imageSrcSets"> & {
    descriptionHtml?: string;
  };
  categoryIds: number[];
};

/**
 * Valida y normaliza el formulario de producto (alta y edición comparten las
 * mismas reglas). Devuelve los valores listos para la tabla o un error legible.
 */
async function normalizeProductInput(
  raw: AdminProductCreateInput,
): Promise<{ ok: true; data: NormalizedProduct } | { ok: false; error: string }> {
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) return { ok: false, error: "El nombre es obligatorio." };
  if (name.length > 200) return { ok: false, error: "El nombre no puede superar los 200 caracteres." };

  const brand = typeof raw.brand === "string" ? raw.brand.trim() : "";
  if (!brand) return { ok: false, error: "La marca es obligatoria." };

  if (!Number.isInteger(raw.price) || (raw.price as number) <= 0 || (raw.price as number) > 999_999_999) {
    return { ok: false, error: "El precio debe ser un entero mayor a 0." };
  }
  const compareAtPrice = raw.compareAtPrice ?? null;
  if (compareAtPrice !== null && (!Number.isInteger(compareAtPrice) || compareAtPrice <= 0)) {
    return { ok: false, error: "El precio anterior debe ser un entero mayor a 0 o estar vacío." };
  }
  const stock = raw.stock ?? 0;
  if (!Number.isInteger(stock) || stock < 0 || stock > 999_999) {
    return { ok: false, error: "El stock debe ser un entero entre 0 y 999999." };
  }

  const categorySlug = typeof raw.categorySlug === "string" ? raw.categorySlug.trim() : "";
  if (!categorySlug) return { ok: false, error: "Elegí una categoría principal." };

  const condition = typeof raw.condition === "string" && raw.condition ? raw.condition.trim() : "Nuevo";
  if (condition !== "Nuevo" && condition !== "Usado") {
    return { ok: false, error: "El estado debe ser Nuevo o Usado." };
  }
  const isUnlocked = raw.isUnlocked ?? true;
  if (typeof isUnlocked !== "boolean") {
    return { ok: false, error: "El campo liberado debe ser verdadero o falso." };
  }
  const featured = raw.featured ?? false;
  if (typeof featured !== "boolean") {
    return { ok: false, error: "El campo destacado debe ser verdadero o falso." };
  }
  const warrantyMonths = raw.warrantyMonths ?? 6;
  if (!Number.isInteger(warrantyMonths) || warrantyMonths < 0 || warrantyMonths > 60) {
    return { ok: false, error: "La garantía debe ser un entero entre 0 y 60 meses." };
  }

  const images = Array.isArray(raw.images) ? raw.images.map((u) => (typeof u === "string" ? u.trim() : "")) : [];
  if (images.length > 8) return { ok: false, error: "Podés agregar hasta 8 imágenes." };
  if (images.some((u) => !isHttpUrl(u))) {
    return { ok: false, error: "Cada imagen debe ser una URL http(s) válida." };
  }

  const highlights = Array.isArray(raw.highlights)
    ? raw.highlights.map((h) => text(h, 200)).filter(Boolean).slice(0, 12)
    : [];
  const specs: Spec[] = [];
  if (Array.isArray(raw.specs)) {
    for (const spec of raw.specs.slice(0, 40)) {
      const label = text(spec?.label, 80);
      const value = text(spec?.value, 300);
      if (!label && !value) continue;
      if (!label || !value) return { ok: false, error: "Cada fila de la ficha técnica necesita dato y valor." };
      specs.push({ label, value });
    }
  }

  const allCategories = await db.select({ id: categories.id, slug: categories.slug }).from(categories);
  const bySlug = new Map(allCategories.map((c) => [c.slug, c.id]));
  const byId = new Map(allCategories.map((c) => [c.id, c.id]));
  const mainCategoryId = bySlug.get(categorySlug);
  if (!mainCategoryId) return { ok: false, error: "La categoría principal no existe." };

  const secondary = Array.isArray(raw.secondaryCategorySlugs) ? raw.secondaryCategorySlugs : [];
  const secondaryIds: number[] = [];
  for (const entry of secondary) {
    const token = typeof entry === "string" ? entry.trim() : "";
    if (!token) continue;
    const id = /^\d+$/.test(token) ? byId.get(Number(token)) : bySlug.get(token);
    if (!id) return { ok: false, error: "Una de las categorías secundarias no existe." };
    secondaryIds.push(id);
  }

  const badge = (typeof raw.badge === "string" ? raw.badge : "").trim().slice(0, 40) || null;
  const tags = Array.isArray(raw.tags)
    ? raw.tags.map((t) => (typeof t === "string" ? t.trim() : "")).filter(Boolean).map((t) => t.slice(0, 30)).slice(0, 20)
    : [];

  return {
    ok: true,
    data: {
      values: {
        sku: text(raw.sku, 100),
        name,
        brand,
        categorySlug,
        shortDescription: typeof raw.shortDescription === "string" ? raw.shortDescription.trim() : "",
        description: typeof raw.description === "string" ? raw.description.trim() : "",
        ...(typeof raw.descriptionHtml === "string" ? { descriptionHtml: sanitizeHtml(raw.descriptionHtml) } : {}),
        price: raw.price,
        compareAtPrice,
        stock,
        images,
        highlights,
        specs,
        tags,
        badge,
        featured,
        warrantyMonths,
        model: text(raw.model, 100),
        storage: text(raw.storage, 100),
        ram: text(raw.ram, 100),
        condition,
        isUnlocked,
        weight: text(raw.weight, 60) || null,
        dimensions: text(raw.dimensions, 100) || null,
        updatedAt: new Date(),
        seoTitle: text(raw.seoTitle, 200) || null,
        seoDescription: text(raw.seoDescription, 300) || null,
      },
      categoryIds: [...new Set([mainCategoryId, ...secondaryIds])],
    },
  };
}

/**
 * Alta manual de producto (origen `manual`, protegido del prune de `migrate-wp`).
 * La descripción del form es texto plano: `descriptionHtml` queda vacío y
 * `imageSrcSets` son arrays vacíos por foto (la galería tolera srcsets vacíos
 * y pinta el `<img>` directo). Devuelve error legible en español o el slug.
 */
export async function createAdminProduct(raw: AdminProductCreateInput): Promise<CreateAdminProductResult> {
  const normalized = await normalizeProductInput(raw);
  if (!normalized.ok) return { ok: false, error: normalized.error, status: 400 };
  const { values, categoryIds } = normalized.data;

  const base = slugifyProductName(values.name);
  if (!base) return { ok: false, error: "No se pudo generar un slug a partir del nombre.", status: 400 };
  const slug = await uniqueProductSlug(base);

  let productId: number;
  try {
    const [created] = await db
      .insert(products)
      .values({
        ...values,
        slug,
        // Texto plano por ahora: el alta no edita HTML.
        descriptionHtml: "",
        // Sin variantes locales: un array vacío por foto, que la galería
        // (`srcSets[index] ?? []`) y `ProductImg` (`srcSet = []`) toleran.
        imageSrcSets: values.images!.map(() => []),
        origin: "manual",
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

  await db
    .insert(productCategories)
    .values(categoryIds.map((categoryId) => ({ productId, categoryId })))
    .onConflictDoNothing();

  return { ok: true, slug };
}

export type AdminProductEditData = AdminProductCreateInput & {
  slug: string;
  descriptionHtml: string;
  origin: string;
  compareAtPrice: number | null;
  badge: string | null;
};

/** Producto completo para el formulario de edición, con sus categorías secundarias. */
export async function getAdminProductForEdit(slug: string): Promise<AdminProductEditData | null> {
  const product = await findProductBySlug(slug);
  if (!product) return null;
  const rows = await db
    .select({ slug: categories.slug })
    .from(productCategories)
    .innerJoin(categories, eq(productCategories.categoryId, categories.id))
    .where(eq(productCategories.productId, product.id));
  return {
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    model: product.model,
    storage: product.storage,
    ram: product.ram,
    condition: product.condition,
    isUnlocked: product.isUnlocked,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    stock: product.stock,
    sku: product.sku,
    categorySlug: product.categorySlug,
    secondaryCategorySlugs: rows.map((r) => r.slug).filter((s) => s !== product.categorySlug),
    shortDescription: product.shortDescription,
    description: product.description,
    descriptionHtml: product.descriptionHtml,
    images: product.images,
    badge: product.badge,
    featured: product.featured,
    warrantyMonths: product.warrantyMonths,
    tags: product.tags,
    seoTitle: product.seoTitle ?? "",
    seoDescription: product.seoDescription ?? "",
    weight: product.weight ?? "",
    dimensions: product.dimensions ?? "",
    highlights: product.highlights,
    specs: product.specs,
    origin: product.origin,
  };
}

/**
 * Edición completa desde el admin. El slug no cambia (no se rompen links ni
 * SEO). La fila pasa a origen `manual` para que una migración de WooCommerce
 * no pise lo editado acá.
 */
export async function updateAdminProductFull(slug: string, raw: AdminProductCreateInput): Promise<CreateAdminProductResult> {
  const existing = await findProductBySlug(slug);
  if (!existing) return { ok: false, error: "Producto inexistente.", status: 404 };

  const normalized = await normalizeProductInput(raw);
  if (!normalized.ok) return { ok: false, error: normalized.error, status: 400 };
  const { values, categoryIds } = normalized.data;

  // Conserva el srcset de las fotos que siguen; las nuevas van sin variantes.
  const srcSetByUrl = new Map(existing.images.map((url, i) => [url, existing.imageSrcSets[i] ?? []]));
  const imageSrcSets = values.images!.map((url) => srcSetByUrl.get(url) ?? []);

  await db
    .update(products)
    .set({ ...values, imageSrcSets, origin: "manual" })
    .where(eq(products.id, existing.id));

  await db.delete(productCategories).where(eq(productCategories.productId, existing.id));
  await db
    .insert(productCategories)
    .values(categoryIds.map((categoryId) => ({ productId: existing.id, categoryId })))
    .onConflictDoNothing();

  return { ok: true, slug: existing.slug };
}

// ─── Archivo (baja reversible) ───────────────────────────────────────

/**
 * Archivar saca el producto de `products` (deja de verse en la tienda, el
 * buscador, el sitemap y el feed sin tocar esas consultas) y guarda la fila
 * completa en `product_archive` para poder restaurarla. Los pedidos y reseñas
 * viejos no se rompen: guardan nombre, precio e imagen propios.
 */
let archiveReady: Promise<void> | null = null;
function ensureArchiveTable(): Promise<void> {
  if (!archiveReady) {
    archiveReady = db
      .execute(
        sql`create table if not exists product_archive (
          id serial primary key,
          slug text not null unique,
          name text not null,
          data jsonb not null,
          category_ids jsonb not null default '[]'::jsonb,
          archived_at timestamptz not null default now()
        )`,
      )
      .then(() => undefined)
      .catch((error) => {
        archiveReady = null;
        throw error;
      });
  }
  return archiveReady;
}

export async function archiveAdminProduct(slug: string): Promise<string | null> {
  await ensureArchiveTable();
  const existing = await findProductBySlug(slug);
  if (!existing) return "Producto inexistente.";
  const cats = await db
    .select({ id: productCategories.categoryId })
    .from(productCategories)
    .where(eq(productCategories.productId, existing.id));

  await db.transaction(async (tx) => {
    await tx.execute(sql`
      insert into product_archive (slug, name, data, category_ids)
      values (${existing.slug}, ${existing.name}, ${JSON.stringify(existing)}::jsonb, ${JSON.stringify(cats.map((c) => c.id))}::jsonb)
      on conflict (slug) do update set name = excluded.name, data = excluded.data,
        category_ids = excluded.category_ids, archived_at = now()
    `);
    await tx.delete(productCategories).where(eq(productCategories.productId, existing.id));
    await tx.delete(products).where(eq(products.id, existing.id));
  });
  return null;
}

export type ArchivedProductRow = { slug: string; name: string; price: number; image: string; archivedAt: Date };

export async function listArchivedProducts(): Promise<ArchivedProductRow[]> {
  await ensureArchiveTable();
  const result = await db.execute<{ slug: string; name: string; price: number; image: string | null; archived_at: string }>(sql`
    select slug, name, (data->>'price')::int as price, data->'images'->>0 as image, archived_at
    from product_archive order by archived_at desc limit 200
  `);
  return result.rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    price: r.price,
    image: r.image ?? "",
    archivedAt: new Date(r.archived_at),
  }));
}

export async function restoreAdminProduct(slug: string): Promise<string | null> {
  await ensureArchiveTable();
  const result = await db.execute<{ data: typeof products.$inferSelect; category_ids: number[] }>(
    sql`select data, category_ids from product_archive where slug = ${slug} limit 1`,
  );
  const row = result.rows[0];
  if (!row) return "No está en archivados.";
  const [taken] = await db.select({ id: products.id }).from(products).where(eq(products.slug, slug)).limit(1);
  if (taken) return "Ya hay un producto activo con esa URL. Cambiale el nombre o archivalo antes de restaurar.";

  const { id: _id, createdAt, updatedAt, ...data } = row.data;
  const validIds = new Set((await db.select({ id: categories.id }).from(categories)).map((c) => c.id));
  const ids = (row.category_ids ?? []).filter((id) => validIds.has(id));

  const restoredOk = await db.transaction(async (tx) => {
    const [restored] = await tx
      .insert(products)
      .values({ ...data, createdAt: new Date(createdAt), updatedAt: new Date(updatedAt) })
      .returning({ id: products.id });
    if (!restored) return false;
    if (ids.length) {
      await tx
        .insert(productCategories)
        .values(ids.map((categoryId) => ({ productId: restored.id, categoryId })))
        .onConflictDoNothing();
    }
    await tx.execute(sql`delete from product_archive where slug = ${slug}`);
    return true;
  });
  if (!restoredOk) return "No se pudo restaurar.";
  return null;
}
