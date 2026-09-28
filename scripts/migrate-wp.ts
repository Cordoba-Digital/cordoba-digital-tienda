/**
 * Migración del catálogo real desde WooCommerce (WC Store API v3).
 *
 * Uso:
 *   npm run migrate:wp -- --dry-run   # solo lee y lista conteos, no escribe
 *   npm run migrate:wp                 # upsert real en Postgres
 *
 * Envs requeridos:
 *   WC_STORE_URL, WC_CONSUMER_KEY, WC_CONSUMER_SECRET
 *   DATABASE_URL (solo en modo real, no en --dry-run)
 */
import "dotenv/config";

import { categories, products } from "@/db/schema";

// ─── Tipos mínimos de la API de WooCommerce ──────────────────────────

type WPCategory = {
  id: number;
  name: string;
  slug: string;
  description?: string;
  menu_order?: number;
};

type WPImage = {
  src: string;
};

type WPAttribute = {
  name: string;
  slug?: string;
  options?: string[];
};

type WPTerm = {
  slug: string;
  name: string;
};

type WPProduct = {
  id: number;
  name: string;
  slug: string;
  sku?: string;
  short_description?: string;
  description?: string;
  price?: string;
  regular_price?: string;
  sale_price?: string;
  stock_quantity?: number | null;
  images?: WPImage[];
  attributes?: WPAttribute[];
  categories?: WPTerm[];
  tags?: WPTerm[];
};

const PER_PAGE = 100;

// ─── Helpers ─────────────────────────────────────────────────────────

function stripHtml(html?: string | null): string {
  if (!html) return "";
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** "1234.50" -> 123450 (centavos ARS). null si vacío/inválido. */
function toCents(value?: string | null): number | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number.parseFloat(trimmed);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function getBrand(attributes?: WPAttribute[]): string {
  if (!attributes?.length) return "General";
  const paAttr = attributes.find(
    (a) =>
      a.slug?.toLowerCase().startsWith("pa_") ||
      a.name.toLowerCase().startsWith("pa_"),
  );
  const fallback = paAttr ?? attributes[0];
  const firstOption = fallback?.options?.[0]?.trim();
  return firstOption ? firstOption : "General";
}

function getCategorySlug(cats?: WPTerm[]): string {
  const slug = cats?.[0]?.slug?.trim();
  return slug ? slug : "general";
}

async function fetchAll<T>(
  endpoint: string,
  storeUrl: string,
  key: string,
  secret: string,
): Promise<T[]> {
  const out: T[] = [];
  let page = 1;
  for (;;) {
    const url =
      `${storeUrl}/wp-json/wc/v3/${endpoint}` +
      `?per_page=${PER_PAGE}&page=${page}` +
      `&consumer_key=${encodeURIComponent(key)}` +
      `&consumer_secret=${encodeURIComponent(secret)}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`${endpoint} page ${page}: HTTP ${res.status} ${res.statusText}`);
    }
    const batch = (await res.json()) as T[];
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    console.log(`[migrate-wp] ${endpoint}: página ${page} (${batch.length} items, total ${out.length})`);
    if (batch.length < PER_PAGE) break;
    page += 1;
  }
  return out;
}

// ─── Main ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");

  const storeUrlRaw = process.env.WC_STORE_URL?.trim();
  const consumerKey = process.env.WC_CONSUMER_KEY?.trim();
  const consumerSecret = process.env.WC_CONSUMER_SECRET?.trim();

  if (!storeUrlRaw || !consumerKey || !consumerSecret) {
    console.error(
      "[migrate-wp] Faltan envs: WC_STORE_URL, WC_CONSUMER_KEY y WC_CONSUMER_SECRET son requeridos.",
    );
    process.exit(1);
  }
  const storeUrl = storeUrlRaw.replace(/\/+$/, "");

  // 1. Leer categorías y productos paginando.
  let wpCategories: WPCategory[] = [];
  try {
    wpCategories = await fetchAll<WPCategory>("categories", storeUrl, consumerKey, consumerSecret);
  } catch (error) {
    console.error(`[migrate-wp] ERROR categorías: ${(error as Error).message} (sigo con productos)`);
  }

  let wpProducts: WPProduct[] = [];
  try {
    wpProducts = await fetchAll<WPProduct>("products", storeUrl, consumerKey, consumerSecret);
  } catch (error) {
    console.error(`[migrate-wp] ERROR productos: ${(error as Error).message}`);
    process.exit(1);
  }

  // 2. Mapear categorías.
  const mappedCategories: typeof categories.$inferInsert[] = [];
  let skippedCategories = 0;
  for (const c of wpCategories) {
    try {
      if (!c.slug?.trim() || !c.name?.trim()) {
        skippedCategories += 1;
        console.error(`[migrate-wp] categoría id=${c.id} sin slug/name, omitida`);
        continue;
      }
      mappedCategories.push({
        slug: c.slug.trim(),
        name: c.name.trim(),
        icon: "📦",
        tagline: stripHtml(c.description).slice(0, 200),
        sortOrder: typeof c.menu_order === "number" ? c.menu_order : 0,
      });
    } catch (error) {
      skippedCategories += 1;
      console.error(`[migrate-wp] ERROR mapeo categoría id=${c.id}: ${(error as Error).message}`);
    }
  }

  // 3. Mapear productos.
  const mappedProducts: typeof products.$inferInsert[] = [];
  let skippedProducts = 0;
  for (const p of wpProducts) {
    try {
      if (!p.slug?.trim() || !p.name?.trim()) {
        skippedProducts += 1;
        console.error(`[migrate-wp] producto id=${p.id} sin slug/name, omitido`);
        continue;
      }
      const regularCents = toCents(p.regular_price);
      const priceCents = toCents(p.price) ?? regularCents;
      if (priceCents == null) {
        skippedProducts += 1;
        console.error(`[migrate-wp] producto '${p.slug}' sin precio válido, omitido`);
        continue;
      }
      const saleCents = toCents(p.sale_price);
      const compareAtPrice =
        saleCents != null && regularCents != null && regularCents > priceCents
          ? regularCents
          : null;

      mappedProducts.push({
        slug: p.slug.trim(),
        sku: p.sku?.trim() ?? "",
        name: p.name.trim(),
        brand: getBrand(p.attributes),
        categorySlug: getCategorySlug(p.categories),
        shortDescription: stripHtml(p.short_description).slice(0, 500),
        description: stripHtml(p.description),
        price: priceCents,
        compareAtPrice,
        stock: p.stock_quantity ?? 0,
        rating: 48,
        reviewCount: 0,
        soldCount: 0,
        images: (p.images ?? []).map((i) => i.src).filter((s) => Boolean(s)),
        highlights: [],
        specs: (p.attributes ?? [])
          .map((a) => ({ label: a.name, value: (a.options ?? []).join(", ") }))
          .filter((s) => s.label && s.value)
          .slice(0, 20),
        tags: (p.tags ?? [])
          .map((t) => t.slug || t.name)
          .filter((t) => Boolean(t))
          .slice(0, 20),
        badge: null,
        featured: false,
        freeShipping: false,
        warrantyMonths: 12,
      });
    } catch (error) {
      skippedProducts += 1;
      console.error(`[migrate-wp] ERROR mapeo producto id=${p.id}: ${(error as Error).message}`);
    }
  }

  console.log(
    `[migrate-wp] Mapeo listo: ${mappedCategories.length} categorías (${skippedCategories} omitidas), ` +
      `${mappedProducts.length} productos (${skippedProducts} omitidos).`,
  );
  if (mappedProducts.length > 0) {
    console.log(
      `[migrate-wp] Ejemplo productos: ${mappedProducts.slice(0, 5).map((p) => p.slug).join(", ")}`,
    );
  }

  if (dryRun) {
    console.log("[migrate-wp] --dry-run: no se escribió nada en la DB.");
    return;
  }

  // 4. Upsert real (import dinámico para no exigir DATABASE_URL en dry-run).
  const { db, pool } = await import("@/db");

  let okCats = 0;
  let failCats = 0;
  for (const c of mappedCategories) {
    try {
      await db
        .insert(categories)
        .values(c)
        .onConflictDoUpdate({
          target: categories.slug,
          set: { name: c.name, icon: c.icon, tagline: c.tagline, sortOrder: c.sortOrder },
        });
      okCats += 1;
    } catch (error) {
      failCats += 1;
      console.error(`[migrate-wp] ERROR upsert categoría '${c.slug}': ${(error as Error).message}`);
    }
  }
  console.log(`[migrate-wp] Categorías: ${okCats} ok, ${failCats} errores.`);

  let okProducts = 0;
  let failProducts = 0;
  for (const p of mappedProducts) {
    try {
      await db
        .insert(products)
        .values(p)
        .onConflictDoUpdate({
          target: products.slug,
          set: {
            sku: p.sku,
            name: p.name,
            brand: p.brand,
            categorySlug: p.categorySlug,
            shortDescription: p.shortDescription,
            description: p.description,
            price: p.price,
            compareAtPrice: p.compareAtPrice,
            stock: p.stock,
            images: p.images,
            highlights: p.highlights,
            specs: p.specs,
            tags: p.tags,
            badge: p.badge,
            featured: p.featured,
            freeShipping: p.freeShipping,
            warrantyMonths: p.warrantyMonths,
          },
        });
      okProducts += 1;
      if (okProducts % 50 === 0) {
        console.log(`[migrate-wp] productos: ${okProducts}/${mappedProducts.length}...`);
      }
    } catch (error) {
      failProducts += 1;
      console.error(`[migrate-wp] ERROR upsert producto '${p.slug}': ${(error as Error).message}`);
    }
  }
  console.log(`[migrate-wp] Productos: ${okProducts} ok, ${failProducts} errores.`);

  await pool.end();
}

main().catch(async (error) => {
  console.error(`[migrate-wp] FATAL: ${(error as Error).message}`);
  try {
    const { pool } = await import("@/db");
    await pool.end();
  } catch {
    // sin DB (dry-run) o pool ya cerrado
  }
  process.exit(1);
});
