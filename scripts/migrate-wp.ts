/**
 * Migración del catálogo real desde WooCommerce usando la **WC Store API pública**
 * (`/wp-json/wc/store/v1`), que **no requiere credenciales** (sin consumer key/secret).
 *
 * Orden de escritura: marcas (derivadas de los productos, `products.brand` es texto)
 * → categorías (padres antes que hijos, en pasadas por profundidad) → productos
 * (lotes de 50 con `onConflictDoUpdate` sobre `slug`) → puente `productCategories`.
 *
 * Uso:
 *   npm run migrate:wp -- --dry-run            # lee todo, no escribe, imprime tabla de conteos
 *   npm run migrate:wp -- --dry-run --limit=2  # solo las primeras 2 páginas de productos
 *   npm run migrate:wp                          # upsert real en Postgres
 *   npm run migrate:wp -- --prune               # además borra lo que no existe en WP
 *
 * Envs:
 *   WC_STORE_URL   (default https://www.cordobadigital.net) — solo lectura, siempre
 *   DATABASE_URL   solo en modo real (import dinámico de `@/db`)
 *
 * Las claves `WC_CONSUMER_KEY` / `WC_CONSUMER_SECRET` ya no se usan: si están puestas
 * en el entorno se ignoran.
 */
import "dotenv/config";

import { eq, inArray, notInArray, sql } from "drizzle-orm";

import { categories, productCategories, products, type Spec } from "@/db/schema";

// ─── Config ──────────────────────────────────────────────────────────

const STORE_URL = (process.env.WC_STORE_URL ?? "https://www.cordobadigital.net").replace(/\/+$/, "");
/** El server WP bloquea requests sin UA moderno (403 "Your browser is outdated"). */
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const PER_PAGE = 100;
const CONCURRENCY = 2; // pool chico: la API pública no tolera mucha concurrencia
const TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;
const DB_BATCH = 50;
const PRUNE_CHUNK = 1000;
const MAX_CATEGORY_PASSES = 5; // el árbol real tiene 3 niveles, sobra margen
const MAX_TAGS = 30;
const MAX_SHORT_DESCRIPTION = 500;
const BADGE_MIN_DISCOUNT = 0.05;
const FALLBACK_CATEGORY = "general";
const FALLBACK_BRAND = "General";
const DEFAULT_ICON = "📦";

// ─── Tipos de la WC Store API (subset verificado del payload real) ──

type WPTerm = { id: number; name: string; slug: string };

type WPCategory = {
  id: number;
  name: string;
  slug: string;
  description?: string;
  parent: number;
  count: number;
  image?: { src?: string } | null;
  permalink?: string;
  review_count?: number;
};

type WPImage = { src: string; thumbnail?: string; alt?: string };

type WPProduct = {
  id: number;
  name: string;
  slug: string;
  sku: string;
  type: string;
  short_description?: string;
  description?: string;
  on_sale: boolean;
  prices: { price: string; regular_price: string; sale_price: string; currency_code: string };
  is_in_stock: boolean;
  low_stock_remaining?: number | null;
  average_rating?: string;
  review_count?: number;
  images?: WPImage[];
  categories?: WPTerm[];
  tags?: WPTerm[];
  brands?: WPTerm[];
  attributes?: unknown[];
  has_options?: boolean;
  permalink?: string;
  weight?: string | null;
  /** La Store API devuelve un objeto `{length,width,height}` en cm, no un string. */
  dimensions?: { length?: string | null; width?: string | null; height?: string | null } | null;
};

type Page<T> = { items: T[]; total: number; totalPages: number; errors: number };

// ─── Fetch con reintentos, timeout y pool chico ───────────────────────

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function fetchJson<T>(url: string, label: string): Promise<{ data: T; total: number }> {
  let lastMessage = "desconocido";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": UA, accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const total = Number(res.headers.get("x-wp-total") ?? 0);
      return { data: (await res.json()) as T, total };
    } catch (error) {
      lastMessage = (error as Error).message;
      if (attempt < MAX_ATTEMPTS) {
        const backoff = 500 * 2 ** (attempt - 1);
        console.error(`[migrate-wp] ${label}: ${lastMessage} — reintento ${attempt + 1}/${MAX_ATTEMPTS} en ${backoff}ms`);
        await sleep(backoff);
      }
    }
  }
  throw new Error(`${label}: ${lastMessage}`);
}

async function fetchPage<T>(endpoint: string, page: number): Promise<{ data: T[]; total: number }> {
  const url = `${STORE_URL}/wp-json/wc/store/v1/${endpoint}?per_page=${PER_PAGE}&page=${page}`;
  const { data, total } = await fetchJson<T[]>(url, `${endpoint} página ${page}`);
  if (!Array.isArray(data)) throw new Error(`${endpoint} página ${page}: respuesta no es un array`);
  return { data, total };
}

/**
 * Pagina un endpoint de la Store API con pool de `CONCURRENCY` workers.
 * Los errores de páginas puntuales se cuentan y no abortan el resto.
 * El resultado viene ordenado por `id` para que el mapeo sea determinístico.
 */
async function apiAll<T extends { id: number }>(endpoint: string, maxPages: number, key: keyof T & string): Promise<Page<T>> {
  const first = await fetchPage<T>(endpoint, 1);
  const total = first.total || first.data.length;
  const items: T[] = [...first.data];
  let errors = 0;

  // Sin `x-wp-total` no se puede calcular el número de páginas: secuencial.
  const totalPages = first.total
    ? Math.min(Math.max(1, Math.ceil(first.total / PER_PAGE)), Math.max(maxPages, 1))
    : Math.max(maxPages, 1);

  let nextPage = 2;
  const worker = async (): Promise<void> => {
    for (;;) {
      const page = nextPage++;
      if (page > totalPages) return;
      try {
        const { data } = await fetchPage<T>(endpoint, page);
        if (data.length) items.push(...data);
        process.stdout.write(`\r  [${endpoint}] página ${page}/${totalPages} · ${items.length}/${total}   `);
      } catch (error) {
        errors += 1;
        console.error(`\n[migrate-wp] ${endpoint} página ${page} falló: ${(error as Error).message} (sigo)`);
      }
    }
  };

  const workers = Array.from({ length: Math.min(CONCURRENCY, Math.max(totalPages - 1, 1)) }, worker);
  await Promise.all(workers);
  process.stdout.write("\n");

  items.sort((a, b) => Number(a[key] ?? 0) - Number(b[key] ?? 0));
  return { items, total: total || items.length, totalPages, errors };
}

// ─── Saneo de HTML (sin dependencias externas) ────────────────────────

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "ul",
  "ol",
  "li",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "a",
  "img",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "blockquote",
  "span",
]);

/** Únicos atributos permitidos por tag (esto ya descarta `on*` y `style`). */
const ALLOWED_ATTRS: Record<string, readonly string[]> = {
  a: ["href"],
  img: ["src", "alt"],
};

const VOID_TAGS = new Set(["br", "img"]);
/** Tags dangerousos: se borran con todo su contenido. */
const DROP_WITH_CONTENT = new Set(["script", "style", "iframe", "noscript", "object", "embed", "form", "svg", "math"]);

const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>])*?)(\/?)>/g;
const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
const UNSAFE_URL_RE = /^\s*(?:javascript|vbscript|data)\s*:/i;

/** `&#8211;` / `&#8217;` yimilar → carácter (solo códigos no ASCII, para no romper el HTML). */
function decodeEntities(input: string): string {
  return input.replace(/&#x([0-9a-f]{2,6});|&#[0-9]{3,7};/gi, (raw) => {
    const hex = /^&#x/i.test(raw);
    const code = Number.parseInt(raw.replace(/&#x?|&;|#/gi, ""), hex ? 16 : 10);
    if (!Number.isFinite(code) || code < 160 || code > 0x10ffff) return raw;
    try {
      return String.fromCodePoint(code);
    } catch {
      return raw;
    }
  });
}

function escapeAttrValue(value: string): string {
  return value.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function cleanAttrs(tag: string, raw: string): string {
  const allowed = ALLOWED_ATTRS[tag];
  if (!allowed) return "";
  const kept: string[] = [];
  for (const m of raw.matchAll(ATTR_RE)) {
    const name = m[1].toLowerCase();
    if (!allowed.includes(name)) continue; // descarta on*, style, class, id, data-*
    const value = m[2] ?? m[3] ?? m[4] ?? "";
    if (UNSAFE_URL_RE.test(value)) continue;
    kept.push(`${name}="${escapeAttrValue(value)}"`);
  }
  return kept.length ? ` ${kept.join(" ")}` : "";
}

/** Allowlist estricta de tags/atributos + borrado de bloques peligrosos. */
export function sanitizeHtml(html?: string | null): string {
  if (!html) return "";
  let out = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");
  for (const tag of DROP_WITH_CONTENT) {
    out = out
      .replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, "gi"), "")
      .replace(new RegExp(`<\\/${tag}\\s*>`, "gi"), "")
      .replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, "gi"), "");
  }
  out = out.replace(TAG_RE, (match, closing: string, rawTag: string, rawAttrs: string, selfClose: string) => {
    const tag = rawTag.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return ""; // unwrap: se conserva el texto interno
    if (closing) return VOID_TAGS.has(tag) ? "" : `</${tag}>`;
    const attrs = cleanAttrs(tag, rawAttrs ?? "");
    return VOID_TAGS.has(tag) || selfClose ? `<${tag}${attrs} />` : `<${tag}${attrs}>`;
  });
  return decodeEntities(out)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── Helpers de texto (mismo criterio que scripts/audit-wp.ts) ───────

function stripHtml(html?: string | null): string {
  if (!html) return "";
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#8211;|&#8212;/gi, "-")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(Number(d)))
    .replace(/\s+/g, " ")
    .trim();
}

function extractHighlights(html?: string | null, limit = 6): string[] {
  if (!html) return [];
  const out: string[] = [];
  for (const m of html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
    const text = stripHtml(m[1]);
    if (text.length >= 8 && text.length <= 180) out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

/** La Store API ya devuelve centavos como strings: NO multiplicar por 100. */
function toCents(value?: string | null): number | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const money = (cents: number): string =>
  `$${(cents / 100).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;

/** `{length,width,height}` en cm → `"10x15x10 cm"`. null si falta todo. */
function formatDimensions(d: WPProduct["dimensions"]): string | null {
  if (!d || typeof d !== "object") return null;
  const parts = [d.length, d.width, d.height]
    .map((v) => (v == null ? "" : String(v).trim()))
    .filter(Boolean);
  if (parts.length === 0) return null;
  return `${parts.join("x")} cm`;
}

// ─── Mapeo ───────────────────────────────────────────────────────────

/** Fila de `products` ya mapeada + los ids de categoría de WP para el puente N:N. */
type MappedProduct = typeof products.$inferInsert & {
  wpId: number;
  catWpIds: number[];
  descriptionHtml: string;
  images: string[];
  highlights: string[];
  specs: Spec[];
  tags: string[];
};

/** Profundidad en el árbol de WP (0 = raíz). Categories cuyo parent no existe = raíz. */
function depthOf(cat: WPCategory, byId: Map<number, WPCategory>): number {
  let depth = 0;
  let cur = cat;
  const seen = new Set<number>();
  while (cur.parent && byId.has(cur.parent) && !seen.has(cur.parent)) {
    seen.add(cur.parent);
    cur = byId.get(cur.parent)!;
    depth += 1;
  }
  return depth;
}

function mapCategory(c: WPCategory, sortOrder: number): typeof categories.$inferInsert {
  const name = stripHtml(c.name).slice(0, 200) || c.slug;
  return {
    slug: c.slug.trim(),
    name,
    icon: DEFAULT_ICON,
    tagline: stripHtml(c.description).slice(0, 200),
    sortOrder,
    // parentId se resuelve en pasadas posteriores (necesita el id serial propio).
    parentId: null,
    descriptionHtml: sanitizeHtml(c.description),
    imageUrl: c.image?.src ?? null,
    wpId: c.id,
  };
}

function mapProduct(
  p: WPProduct,
  byCatId: Map<number, WPCategory>,
  depthByCatId: Map<number, number>,
): MappedProduct {
  const price = toCents(p.prices.price) ?? toCents(p.prices.regular_price) ?? 0;
  const regular = toCents(p.prices.regular_price);
  const onSale = p.on_sale === true;
  const hasDiscount = regular != null && regular > price;
  const compareAtPrice = onSale && hasDiscount ? (regular as number) : null;
  const discount = hasDiscount ? (regular as number) - price : 0;

  const cats = p.categories ?? [];
  // Principal = la categoría más cercana a la raíz; desempata la primera de la lista.
  const primary =
    cats
      .slice()
      .sort((a, b) => (depthByCatId.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (depthByCatId.get(b.id) ?? Number.MAX_SAFE_INTEGER))[0] ??
    undefined;

  const images = [...new Set((p.images ?? []).map((i) => i.src).filter((s): s is string => Boolean(s?.trim())))];

  return {
    slug: p.slug.trim(),
    sku: p.sku?.trim() ?? "",
    name: stripHtml(p.name).slice(0, 300) || p.slug.trim(),
    brand: stripHtml(p.brands?.[0]?.name ?? "") || FALLBACK_BRAND,
    categorySlug: byCatId.has(primary?.id ?? -1) ? (primary?.slug as string) : FALLBACK_CATEGORY,
    shortDescription: stripHtml(p.short_description).slice(0, MAX_SHORT_DESCRIPTION),
    description: stripHtml(p.description),
    descriptionHtml: sanitizeHtml(p.description),
    price,
    compareAtPrice,
    stock: p.is_in_stock ? 1 : 0,
    images,
    highlights: extractHighlights(p.description),
    specs: [], // la Store API no publica atributos
    tags: (p.tags ?? []).map((t) => t.slug?.trim()).filter((t): t is string => Boolean(t)).slice(0, MAX_TAGS),
    badge: onSale && hasDiscount && discount / (regular as number) > BADGE_MIN_DISCOUNT ? "Oferta" : null,
    featured: false,
    freeShipping: false,
    warrantyMonths: 12,
    weight: typeof p.weight === "string" && p.weight.trim() ? p.weight.trim() : null,
    dimensions: formatDimensions(p.dimensions),
    seoTitle: null, // Rank Math no está expuesto en la Store API
    seoDescription: null,
    wpId: p.id,
    catWpIds: cats.map((c) => c.id),
  };
}

// ─── CLI ─────────────────────────────────────────────────────────────

type Flags = { dryRun: boolean; prune: boolean; limit: number | null };

function parseFlags(argv: string[]): Flags {
  const limitArg = argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : NaN;
  return {
    dryRun: argv.includes("--dry-run"),
    prune: argv.includes("--prune"),
    limit: Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : null,
  };
}

function printTable(rows: [string, string | number][], indent = "  "): void {
  const width = Math.max(...rows.map((r) => r[0].length));
  for (const [k, v] of rows) {
    console.log(`${indent}${k.padEnd(width)}  ${typeof v === "number" ? v.toLocaleString("es-AR") : v}`);
  }
}

function printExamples(list: MappedProduct[]): void {
  const header = ["slug", "nombre", "precio", "lista", "stk", "marca", "cat principal", "cats", "tags", "hl", "imgs", "desc"];
  const body = list.slice(0, 10).map((p) => [
    p.slug.slice(0, 42),
    stripHtml(p.name).slice(0, 34),
    money(p.price),
    p.compareAtPrice ? money(p.compareAtPrice) : "-",
    String(p.stock),
    stripHtml(p.brand).slice(0, 14),
    String(p.categorySlug).slice(0, 22),
    String(p.catWpIds.length),
    String((p.tags ?? []).length),
    String((p.highlights ?? []).length),
    String((p.images ?? []).length),
    String(stripHtml(p.description).length),
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...body.map((r) => r[i].length)));
  const line = (cells: string[]): string => cells.map((c, i) => c.padEnd(widths[i])).join("  ");
  console.log(`  ${line(header)}`);
  for (const row of body) console.log(`  ${line(row)}`);
}

// ─── Escritura ───────────────────────────────────────────────────────

type Db = typeof import("@/db").db;

const productUpsertSet = () => ({
  sku: sql`excluded.sku`,
  name: sql`excluded.name`,
  brand: sql`excluded.brand`,
  categorySlug: sql`excluded.category_slug`,
  shortDescription: sql`excluded.short_description`,
  description: sql`excluded.description`,
  descriptionHtml: sql`excluded.description_html`,
  price: sql`excluded.price`,
  compareAtPrice: sql`excluded.compare_at_price`,
  stock: sql`excluded.stock`,
  images: sql`excluded.images`,
  highlights: sql`excluded.highlights`,
  specs: sql`excluded.specs`,
  tags: sql`excluded.tags`,
  badge: sql`excluded.badge`,
  featured: sql`excluded.featured`,
  freeShipping: sql`excluded.free_shipping`,
  warrantyMonths: sql`excluded.warranty_months`,
  weight: sql`excluded.weight`,
  dimensions: sql`excluded.dimensions`,
  seoTitle: sql`excluded.seo_title`,
  seoDescription: sql`excluded.seo_description`,
  wpId: sql`excluded.wp_id`,
});

const categoryUpsertSet = () => ({
  name: sql`excluded.name`,
  icon: sql`excluded.icon`,
  tagline: sql`excluded.tagline`,
  sortOrder: sql`excluded.sort_order`,
  descriptionHtml: sql`excluded.description_html`,
  imageUrl: sql`excluded.image_url`,
  wpId: sql`excluded.wp_id`,
});

type ErrorTally = { ok: number; failed: number; messages: string[] };

function noteError(tally: ErrorTally, message: string): void {
  tally.failed += 1;
  if (tally.messages.length < 15) tally.messages.push(message);
  console.error(`[migrate-wp] ${message}`);
}

/**
 * Inserta las categorías en pasadas: primero las raíces, después cada nivel de
 * hijos, y al final de cada pasada asigna `parentId` con UPDATE agrupado por padre.
 */
async function writeCategories(
  db: Db,
  mapped: { wp: WPCategory; row: typeof categories.$inferInsert }[],
  depthById: Map<number, number>,
  wpIdToOurId: Map<number, number>,
  tally: ErrorTally,
): Promise<void> {
  let pending = mapped.slice();
  let pass = 0;

  while (pending.length > 0 && pass < MAX_CATEGORY_PASSES) {
    pass += 1;
    const depth = pass - 1;
    const batch = pending.filter((m) => depthById.get(m.wp.id) === depth);
    const skip = new Set(batch.map((m) => m.wp.id));
    pending = pending.filter((m) => !skip.has(m.wp.id));
    if (batch.length === 0) continue;

    for (const group of chunk(batch, DB_BATCH)) {
      try {
        await db
          .insert(categories)
          .values(group.map((m) => m.row))
          .onConflictDoUpdate({ target: categories.slug, set: categoryUpsertSet() });
        tally.ok += group.length;
      } catch (error) {
        for (const m of group) noteError(tally, `ERROR upsert categoría '${m.row.slug}': ${(error as Error).message}`);
      }
    }

    // Resolver wpId → id propio para poder setear parentId.
    const slugs = uniqueSlugs(batch.map((m) => m.row.slug));
    if (slugs.length) {
      const rows = await db
        .select({ id: categories.id, slug: categories.slug, wpId: categories.wpId })
        .from(categories)
        .where(inArray(categories.slug, slugs));
      for (const r of rows) if (r.wpId != null) wpIdToOurId.set(r.wpId, r.id);
    }

    // UPDATE por lote: un UPDATE por valor de padre, con todos sus hijos.
    const byParent = new Map<number, number[]>();
    for (const m of batch) {
      const parentOurId = wpIdToOurId.get(m.wp.parent);
      if (parentOurId == null) continue;
      const list = byParent.get(parentOurId) ?? [];
      list.push(wpIdToOurId.get(m.wp.id) ?? -1);
      byParent.set(parentOurId, list);
    }
    for (const [parentOurId, childIds] of byParent) {
      const ids = childIds.filter((id) => id > 0);
      if (!ids.length) continue;
      try {
        await db.update(categories).set({ parentId: parentOurId }).where(inArray(categories.id, ids));
      } catch (error) {
        noteError(tally, `ERROR parentId de ${ids.length} categorías (padre ${parentOurId}): ${(error as Error).message}`);
      }
    }
    console.log(`[migrate-wp] categorías pasada ${pass} (profundidad ${depth}): ${batch.length} · total ok ${tally.ok}`);
  }

  if (pending.length > 0) {
    console.error(
      `[migrate-wp] AVISO: ${pending.length} categorías huérfanas de nivel > ${MAX_CATEGORY_PASSES - 1}, se insertan como raíz.`,
    );
    for (const group of chunk(pending, DB_BATCH)) {
      try {
        await db
          .insert(categories)
          .values(group.map((m) => m.row))
          .onConflictDoUpdate({ target: categories.slug, set: categoryUpsertSet() });
        tally.ok += group.length;
      } catch (error) {
        for (const m of group) noteError(tally, `ERROR upsert categoría '${m.row.slug}': ${(error as Error).message}`);
      }
    }
  }

}

/** slugs únicos no vacíos (para `inArray`/`notInArray`) */
function uniqueSlugs(slugs: string[]): string[] {
  return [...new Set(slugs.map((s) => s.trim()).filter(Boolean))];
}

async function writeProducts(db: Db, mapped: MappedProduct[], tally: ErrorTally): Promise<void> {
  for (const group of chunk(mapped, DB_BATCH)) {
    try {
      await db
        .insert(products)
        .values(group.map(({ catWpIds: _catWpIds, wpId: _wpId, ...row }) => row))
        .onConflictDoUpdate({ target: products.slug, set: productUpsertSet() });
      tally.ok += group.length;
      if (tally.ok % 50 === 0) console.log(`[migrate-wp] productos: ${tally.ok}/${mapped.length}...`);
    } catch (error) {
      for (const p of group) noteError(tally, `ERROR upsert producto '${p.slug}': ${(error as Error).message}`);
    }
  }
}

async function writeBridge(
  db: Db,
  mapped: MappedProduct[],
  wpIdToOurId: Map<number, number>,
  tally: ErrorTally,
): Promise<void> {
  const slugToId = new Map<string, number>();
  for (const r of await db.select({ id: products.id, slug: products.slug }).from(products)) {
    slugToId.set(r.slug, r.id);
  }

  let rows = 0;
  let orphanRefs = 0;
  for (const group of chunk(mapped, DB_BATCH)) {
    const productIds = group.map((p) => slugToId.get(p.slug)).filter((id): id is number => id != null);
    const toInsert: (typeof productCategories.$inferInsert)[] = [];
    const seen = new Set<string>();
    for (const p of group) {
      const productId = slugToId.get(p.slug);
      if (productId == null) continue;
      for (const wpCatId of p.catWpIds) {
        const categoryId = wpIdToOurId.get(wpCatId);
        if (categoryId == null) {
          orphanRefs += 1;
          continue;
        }
        const key = `${productId}:${categoryId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        toInsert.push({ productId, categoryId });
      }
    }
    if (!productIds.length || !toInsert.length) continue;

    try {
      // Borrar y reinsertar por lote: la pasada es idempotente aunque se corte.
      await db.delete(productCategories).where(inArray(productCategories.productId, productIds));
      await db
        .insert(productCategories)
        .values(toInsert)
        .onConflictDoNothing();
      rows += toInsert.length;
      tally.ok += toInsert.length;
      console.log(`[migrate-wp] puente: ${rows} links · ${productIds.length} productos del lote`);
    } catch (error) {
      noteError(tally, `ERROR puente de ${toInsert.length} links: ${(error as Error).message}`);
    }
  }
  if (orphanRefs > 0) console.error(`[migrate-wp] ${orphanRefs} referencias de categoría sin categoría propia (omitidas).`);
}

/**
 * `--prune`: borra productos y categorías de la DB que no existen en el WP
 * (típicamente el seed demo) y limpia los links huérfanos del puente.
 */
async function prune(
  db: Db,
  wpProductSlugs: string[],
  wpCategorySlugs: string[],
  tally: ErrorTally,
): Promise<void> {
  // OJO: primero se calcula la lista de huérfanos y después se borra por
  // `inArray`. Borrar con `notInArray(slug, unChunk)` por chunk deja la base
  // vacía salvo el último chunk.
  const keepProducts = new Set(wpProductSlugs);
  const keepCategories = new Set(wpCategorySlugs);

  const existingProducts = await db.select({ slug: products.slug }).from(products);
  const deadProductSlugs = existingProducts.map((r) => r.slug).filter((slug) => !keepProducts.has(slug));

  for (const group of chunk(deadProductSlugs, PRUNE_CHUNK)) {
    try {
      const deleted = await db
        .delete(products)
        .where(inArray(products.slug, group))
        .returning({ slug: products.slug });
      if (deleted.length) console.log(`[migrate-wp] prune: ${deleted.length} productos borrados (no están en WP)`);
      tally.ok += deleted.length;
    } catch (error) {
      noteError(tally, `ERROR prune de productos: ${(error as Error).message}`);
    }
  }

  const existingCategories = await db.select({ slug: categories.slug }).from(categories);
  const deadCategorySlugs = existingCategories.map((r) => r.slug).filter((slug) => !keepCategories.has(slug));

  for (const group of chunk(deadCategorySlugs, PRUNE_CHUNK)) {
    try {
      const deleted = await db
        .delete(categories)
        .where(inArray(categories.slug, group))
        .returning({ slug: categories.slug });
      if (deleted.length) console.log(`[migrate-wp] prune: ${deleted.length} categorías borradas (no están en WP)`);
      tally.ok += deleted.length;
    } catch (error) {
      noteError(tally, `ERROR prune de categorías: ${(error as Error).message}`);
    }
  }

  // Links del puente que apuntan a productos o categorías que ya no existen.
  try {
    const deadProducts = await db
      .delete(productCategories)
      .where(notInArray(productCategories.productId, db.select({ id: products.id }).from(products)))
      .returning({ id: productCategories.id });
    const deadCategories = await db
      .delete(productCategories)
      .where(notInArray(productCategories.categoryId, db.select({ id: categories.id }).from(categories)))
      .returning({ id: productCategories.id });
    console.log(
      `[migrate-wp] prune: ${deadProducts.length + deadCategories.length} links huérfanos del puente borrados`,
    );
  } catch (error) {
    noteError(tally, `ERROR prune del puente: ${(error as Error).message}`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const productMaxPages = flags.limit ?? 40;

  console.log(`[migrate-wp] tienda: ${STORE_URL}`);
  console.log("[migrate-wp] credenciales: no requeridas (WC Store API pública)");

  console.log("[migrate-wp] descargando categorías…");
  const catPage = await apiAll<WPCategory>("products/categories", 5, "id");
  const wpCategories = catPage.items;

  console.log("[migrate-wp] descargando productos…");
  const prodPage = await apiAll<WPProduct>("products", productMaxPages, "id");
  const wpProducts = prodPage.items;

  // ─── Árbol de categorías ────────────────────────────────────────────
  const byCatId = new Map(wpCategories.map((c) => [c.id, c]));
  const depthByCatId = new Map(wpCategories.map((c) => [c.id, depthOf(c, byCatId)]));
  const roots = wpCategories.filter((c) => depthByCatId.get(c.id) === 0);

  // ─── Marcas derivadas de los productos (products.brand es texto) ───
  const brands = new Map<string, number>();
  for (const p of wpProducts) {
    const b = stripHtml(p.brands?.[0]?.name ?? "");
    if (b) brands.set(b, (brands.get(b) ?? 0) + 1);
  }

  // ─── Mapeo ─────────────────────────────────────────────────────────
  const catTally = { skipped: 0 };
  const sortedByCount = wpCategories
    .slice()
    .sort((a, b) => (depthByCatId.get(a.id) ?? 0) - (depthByCatId.get(b.id) ?? 0) || b.count - a.count || a.name.localeCompare(b.name));
  const mappedCategories: { wp: WPCategory; row: typeof categories.$inferInsert }[] = [];
  const sortOrderById = new Map<number, number>();
  sortedByCount.forEach((c, i) => sortOrderById.set(c.id, i));
  for (const c of wpCategories) {
    if (!c.slug?.trim() || !c.name?.trim()) {
      catTally.skipped += 1;
      console.error(`[migrate-wp] categoría id=${c.id} sin slug/name, omitida`);
      continue;
    }
    mappedCategories.push({ wp: c, row: mapCategory(c, sortOrderById.get(c.id) ?? 0) });
  }

  const mappedProducts: MappedProduct[] = [];
  const productSkips: string[] = [];
  for (const p of wpProducts) {
    try {
      if (!p.slug?.trim() || !p.name?.trim()) {
        productSkips.push(`id=${p.id} sin slug/name`);
        continue;
      }
      if (toCents(p.prices?.price) == null && toCents(p.prices?.regular_price) == null) {
        productSkips.push(`id=${p.id} '${p.slug}' sin precio válido`);
        continue;
      }
      mappedProducts.push(mapProduct(p, byCatId, depthByCatId));
    } catch (error) {
      productSkips.push(`id=${p.id}: ${(error as Error).message}`);
    }
  }

  // ─── Diagnóstico de huérfanos ───────────────────────────────────────
  const knownCatSlugs = new Set(mappedCategories.map((m) => m.row.slug));
  const orphanCatRefs = new Map<number, number>();
  let productsWithoutCategories = 0;
  let missingPrimary = 0;
  for (const p of mappedProducts) {
    if (p.catWpIds.length === 0) productsWithoutCategories += 1;
    if (p.categorySlug === FALLBACK_CATEGORY && p.catWpIds.length > 0) missingPrimary += 1;
    for (const id of p.catWpIds) {
      const cat = byCatId.get(id);
      if (!cat) orphanCatRefs.set(id, (orphanCatRefs.get(id) ?? 0) + 1);
    }
  }
  const knownProductSlugs = new Set(mappedProducts.map((p) => p.slug));

  // ─── Resumen ────────────────────────────────────────────────────────
  const bridgeRows = mappedProducts.reduce(
    (n, p) => n + new Set(p.catWpIds.filter((id) => byCatId.has(id))).size,
    0,
  );
  const onSaleCount = mappedProducts.filter((p) => p.badge === "Oferta").length;
  const outOfStock = mappedProducts.filter((p) => p.stock === 0).length;
  const withHighlights = mappedProducts.filter((p) => (p.highlights ?? []).length > 0).length;
  const withHtml = mappedProducts.filter((p) => p.descriptionHtml.length > 0).length;
  const withImages = mappedProducts.filter((p) => p.images.length > 0).length;
  const multiCat = mappedProducts.filter((p) => new Set(p.catWpIds.filter((id) => byCatId.has(id))).size > 1).length;
  const maxDepth = Math.max(0, ...wpCategories.map((c) => depthByCatId.get(c.id) ?? 0));

  console.log("");
  console.log("[migrate-wp] ── Conteos ──────────────────────────────────────────");
  printTable([
    ["categorías leídas (WP)", wpCategories.length],
    ["  raíz", roots.length],
    ["  profundidad máx", `${maxDepth + 1} niveles`],
    ["  omitidas", catTally.skipped],
    ["marcas distintas (derivadas)", brands.size],
    ["productos leídos (WP)", wpProducts.length],
    ["  páginas de productos", `${prodPage.totalPages} leídas${flags.limit ? ` (--limit=${flags.limit})` : ""}`],
    ["  páginas con error", prodPage.errors],
    ["productos a escribir", mappedProducts.length],
    ["  omitidos", productSkips.length],
    ["links de productCategories", bridgeRows],
    ["con oferta >5%", onSaleCount],
    ["sin stock", outOfStock],
    ["multi-categoría", multiCat],
    ["con highlights", withHighlights],
    ["con descriptionHtml", withHtml],
    ["con imagen", withImages],
  ]);
  console.log("");

  if (productSkips.length) {
    console.log(`[migrate-wp] productos omitidos (primeros 10):`);
    for (const s of productSkips.slice(0, 10)) console.log(`  - ${s}`);
  }

  console.log("[migrate-wp] Ejemplos de productos mapeados:");
  printExamples(mappedProducts);
  console.log("");

  console.log("[migrate-wp] ── Huérfanos ────────────────────────────────────────");
  printTable([
    ["categorías de WP ausentes del catálogo", mappedCategories.length === wpCategories.length ? 0 : catTally.skipped],
    ["categorías inexistentes referenciadas", orphanCatRefs.size],
    ["productos sin ninguna categoría", productsWithoutCategories],
    [`caen en '${FALLBACK_CATEGORY}' con cats`, missingPrimary],
    ["categorías en DB a conservar", knownCatSlugs.size],
    ["productos en DB a conservar", knownProductSlugs.size],
  ]);
  if (orphanCatRefs.size > 0) {
    console.log("  ids de categoría inexistentes (wpId → productos que la referencian):");
    for (const [id, n] of [...orphanCatRefs.entries()].slice(0, 20)) console.log(`    ${id} → ${n}`);
  }
  console.log("");

  // ─── Escritura ──────────────────────────────────────────────────────
  if (flags.dryRun) {
    console.log("[migrate-wp] --dry-run: no se escribió nada en la DB.");
    if (flags.prune) {
      console.log("[migrate-wp] --prune combinado con --dry-run: se listaron los huérfanos de arriba, no se borró nada.");
    }
    return;
  }

  if (!process.env.DATABASE_URL) {
    console.error("[migrate-wp] Falta DATABASE_URL (necesaria fuera de --dry-run).");
    process.exit(1);
  }
  const { db, pool } = await import("@/db");

  try {
    // 1. Marcas: no hay tabla propia, ya quedaron en products.brand.
    console.log(`[migrate-wp] marcas: ${brands.size} valores de products.brand (sin tabla propia).`);

    // 2. Categorías en pasadas por profundidad (padres antes que hijos).
    const catTallyState: ErrorTally = { ok: 0, failed: 0, messages: [] };
    const wpIdToOurId = new Map<number, number>();
    await writeCategories(db, mappedCategories, depthByCatId, wpIdToOurId, catTallyState);
    report("categorías", catTallyState);

    // 3. Productos en lotes de 50.
    const prodTally: ErrorTally = { ok: 0, failed: 0, messages: [] };
    await writeProducts(db, mappedProducts, prodTally);
    report("productos", prodTally);

    // 4. Puente N:N: borrar y reinsertar por lote.
    const bridgeTally: ErrorTally = { ok: 0, failed: 0, messages: [] };
    await writeBridge(db, mappedProducts, wpIdToOurId, bridgeTally);
    report("links product_categories", bridgeTally);

    // 5. Opcional: borrar lo que no existe en WP.
    if (flags.prune) {
      const pruneTally: ErrorTally = { ok: 0, failed: 0, messages: [] };
      await prune(db, [...knownProductSlugs], [...knownCatSlugs], pruneTally);
      report("prune", pruneTally);
    }
  } finally {
    await pool.end();
  }
}

function report(label: string, tally: ErrorTally): void {
  console.log(
    `[migrate-wp] ${label}: ${tally.ok.toLocaleString("es-AR")} ok, ${tally.failed.toLocaleString("es-AR")} errores.`,
  );
  for (const m of tally.messages) console.error(`[migrate-wp]   ${m}`);
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
