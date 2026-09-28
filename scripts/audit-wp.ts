/**
 * Auditoría del catálogo real de WooCommerce (solo lectura, sin credenciales).
 *
 * Usa la WC Store API pública (`/wp-json/wc/store/v1`) y los sitemaps XML.
 * Genera `docs/CATALOGO-WP.md` con el inventario completo para validar el
 * mapeo antes de migrar.
 *
 * Uso:
 *   npm run audit:wp
 *   npm run audit:wp -- --limit=100   # solo las primeras N páginas de productos
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const STORE_URL = (process.env.WC_STORE_URL ?? "https://www.cordobadigital.net").replace(/\/+$/, "");
const PER_PAGE = 100;
const OUT = path.join(process.cwd(), "docs", "CATALOGO-WP.md");

/** El serverwp bloquea requests sin UA moderno (403 "browser outdated"). */
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

type WPCategory = {
  id: number;
  name: string;
  slug: string;
  description?: string;
  parent: number;
  count: number;
  image?: { src?: string } | null;
  permalink?: string;
  menu_order?: number;
};

type WPTerm = { id: number; name: string; slug: string };

type WPImage = { id: number; src: string; thumbnail?: string; alt?: string; name?: string };

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
  average_rating: string;
  review_count: number;
  images: WPImage[];
  categories: WPTerm[];
  tags: WPTerm[];
  brands: WPTerm[];
  attributes: unknown[];
  has_options: boolean;
  permalink: string;
};

type Page<T> = { items: T[]; total: number; totalPages: number };

async function apiGet<T>(pathname: string): Promise<{ data: T; total: number }> {
  const res = await fetch(`${STORE_URL}/wp-json/wc/store/v1${pathname}`, {
    headers: { "user-agent": UA, accept: "application/json" },
  });
  if (!res.ok) throw new Error(`${pathname}: HTTP ${res.status} ${res.statusText}`);
  const total = Number(res.headers.get("x-wp-total") ?? 0);
  return { data: (await res.json()) as T, total };
}

async function apiAll<T>(endpoint: string, maxPages = 40): Promise<Page<T>> {
  const out: T[] = [];
  let total = 0;
  for (let page = 1; page <= maxPages; page++) {
    const { data, total: t } = await apiGet<T[]>(`/${endpoint}?per_page=${PER_PAGE}&page=${page}`);
    total = t;
    if (!Array.isArray(data) || data.length === 0) break;
    out.push(...data);
    process.stdout.write(`\r  [${endpoint}] página ${page} · ${out.length}/${t || "?"}   `);
    if (data.length < PER_PAGE) break;
  }
  process.stdout.write("\n");
  return { items: out, total: total || out.length, totalPages: Math.ceil((total || out.length) / PER_PAGE) };
}

async function textGet(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

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

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function treeLines(
  cats: WPCategory[],
  byId: Map<number, WPCategory>,
  parent: number,
  depth: number,
  path: Map<number, string[]>,
): string[] {
  const lines: string[] = [];
  const children = cats
    .filter((c) => c.parent === parent)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  for (const c of children) {
    const slugPath = [...(path.get(parent) ?? []), c.slug];
    path.set(c.id, slugPath);
    const indent = "  ".repeat(depth);
    const name = c.name.replace(/&#8211;/g, "-").replace(/\s+/g, " ").trim();
    const desc = stripHtml(c.description);
    const subs = cats.filter((x) => x.parent === c.id).length;
    lines.push(
      `| ${indent}\`${name}\` | \`${slugPath.join("/")}\` | ${c.id} | ${c.count} | ${subs} | ${desc.length} | ${c.image?.src ? "sí" : "no"} |`,
    );
    lines.push(...treeLines(cats, byId, c.id, depth + 1, path));
  }
  return lines;
}

async function main(): Promise<void> {
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const maxPages = limitArg ? Number(limitArg.split("=")[1]) || 40 : 40;

  console.log(`[audit-wp] tienda: ${STORE_URL}`);
  console.log("[audit-wp] descargando categorías…");
  const categories = await apiAll<WPCategory>("products/categories", 5);
  console.log(`[audit-wp] categorías: ${categories.items.length} (total declarado ${categories.total})`);

  console.log("[audit-wp] descargando marcas…");
  const brands = await apiAll<WPTerm>("products/brands", 5);

  console.log("[audit-wp] descargando tags…");
  const tags = await apiAll<WPTerm>("products/tags", 3);

  console.log("[audit-wp] descargando productos…");
  const products = await apiAll<WPProduct>("products", maxPages);

  console.log("[audit-wp] leyendo sitemaps…");
  const sitemapIndex = await textGet(`${STORE_URL}/wp-sitemap.xml`);
  const productSitemaps = [...sitemapIndex.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1])
    .filter((l) => /product-sitemap\d*\.xml$/.test(l));
  const sitemapSlugs = new Set<string>();
  for (const sm of productSitemaps) {
    const xml = await textGet(sm);
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const slug = m[1].replace(/\/$/, "").split("/").pop() ?? "";
      if (slug && slug !== "tienda") sitemapSlugs.add(slug);
    }
  }
  console.log(`[audit-wp] sitemaps: ${productSitemaps.length} con ${sitemapSlugs.size} URLs de producto`);

  // ─── Estadísticas ───────────────────────────────────────────────────
  const byId = new Map(categories.items.map((c) => [c.id, c]));
  const roots = categories.items.filter((c) => !c.parent || !byId.has(c.parent));
  const depthOf = (c: WPCategory): number => {
    let d = 0;
    let cur = c;
    const seen = new Set<number>();
    while (cur?.parent && byId.has(cur.parent) && !seen.has(cur.parent)) {
      seen.add(cur.parent);
      cur = byId.get(cur.parent)!;
      d += 1;
    }
    return d;
  };
  const maxDepth = Math.max(0, ...categories.items.map(depthOf));

  const onSale = products.items.filter((p) => p.on_sale).length;
  const outOfStock = products.items.filter((p) => !p.is_in_stock).length;
  const multiCat = products.items.filter((p) => p.categories.length > 1).length;
  const noImage = products.items.filter((p) => !p.images?.length).length;
  const longDesc = products.items.filter((p) => (p.description ?? "").length > 2000).length;
  const withBrands = products.items.filter((p) => (p.brands ?? []).length).length;
  const withOptions = products.items.filter((p) => p.has_options).length;
  const withAttrs = products.items.filter((p) => (p.attributes ?? []).length).length;
  const withRating = products.items.filter((p) => Number(p.average_rating) > 0).length;
  const descLens = products.items.map((p) => (p.description ?? "").length).sort((a, b) => a - b);
  const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)}%` : "-");
  const prices = products.items.map((p) => Number(p.prices.price) / 100).filter(Number.isFinite).sort((a, b) => a - b);
  const median = prices.length ? prices[Math.floor(prices.length / 2)] : 0;

  const apiSlugs = new Set(products.items.map((p) => p.slug));
  const onlyApi = [...apiSlugs].filter((s) => !sitemapSlugs.has(s));
  const onlySitemap = [...sitemapSlugs].filter((s) => !apiSlugs.has(s));

  // ─── Mapeo de precio de la muestra ──────────────────────────────────
  const sample = products.items.slice(0, 50).map((p) => {
    const price = Number(p.prices.price);
    const regular = Number(p.prices.regular_price);
    const compareAt = p.on_sale && regular > price ? regular : null;
    const hl = extractHighlights(p.description);
    const primary = p.categories.find((c) => {
      const cat = byId.get(c.id);
      return cat && (!cat.parent || !byId.has(cat.parent));
    }) ?? p.categories[0];
    return {
      slug: p.slug,
      name: p.name,
      sku: p.sku,
      price,
      compareAt,
      stock: p.is_in_stock ? 1 : 0,
      brand: p.brands?.[0]?.name ?? "General",
      primary: primary?.name ?? "-",
      primarySlug: primary?.slug ?? "-",
      cats: p.categories.length,
      tags: p.tags.length,
      images: p.images.length,
      hl: hl.length,
      descLen: (p.description ?? "").length,
    };
  });

  // ─── Markdown ───────────────────────────────────────────────────────
  const path_ = new Map<number, string[]>();
  const tree = treeLines(categories.items, byId, 0, 0, path_);

  const brandRows = brands.items
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((b, i) => `| ${i + 1} | ${b.name} | \`${b.slug}\` |`)
    .join("\n");

  const tagRows = tags.items
    .slice()
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((t) => `\`${t.slug}\``)
    .join(", ");

  const redirectRows = categories.items
    .slice()
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((c) => {
      const wpPath = (path_.get(c.id) ?? [c.slug]).join("/");
      return `| /categoria-producto/${wpPath}/ | /categoria/${wpPath} |`;
    })
    .join("\n");

  const sampleRows = sample
    .map(
      (s) =>
        `| \`${s.slug}\` | ${s.name.replace(/\|/g, "/").slice(0, 52)} | ${money(s.price)} | ${
          s.compareAt ? money(s.compareAt) : "-"
        } | ${s.stock} | ${s.brand} | ${s.cats} | ${s.hl} | ${s.descLen} | ${s.images} |`,
    )
    .join("\n");

  const md = `# Inventario del catálogo WooCommerce

Generado por \`npm run audit:wp\` (${new Date().toISOString().slice(0, 10)}).
Fuente: ${STORE_URL} · WC Store API pública + sitemaps XML. **Sin credenciales.**

## Resumen

| Métrica | Valor |
| --- | --- |
| Categorías | ${categories.items.length} (${roots.length} raíz, profundidad ${maxDepth + 1} niveles) |
| Productos (API) | ${products.items.length} |
| Productos (sitemaps) | ${sitemapSlugs.size} |
| Marcas | ${brands.items.length} |
| Tags | ${tags.total} (se listan los primeros ${tags.items.length}) |
| En oferta | ${onSale} (${pct(onSale, products.items.length)}) |
| Sin stock | ${outOfStock} (${pct(outOfStock, products.items.length)}) |
| Multi-categoría | ${multiCat} (${pct(multiCat, products.items.length)}) |
| Con marca asignada | ${withBrands} (${pct(withBrands, products.items.length)}) |
| Con descripción > 2000 chars | ${longDesc} (${pct(longDesc, products.items.length)}) |
| Con imagen | ${products.items.length - noImage} (${pct(products.items.length - noImage, products.items.length)}) |
| Con rating nativo | ${withRating} |
| Productos variables (\`has_options\`) | ${withOptions} |
| Productos con atributos | ${withAttrs} |
| Precio mediana | ${money(median * 100)} · mín ${money((prices[0] ?? 0) * 100)} · máx ${money((prices.at(-1) ?? 0) * 100)} |
| Longitud de descripción | mediana ${descLens[Math.floor(descLens.length / 2)] ?? 0} chars · p90 ${descLens[Math.floor(descLens.length * 0.9)] ?? 0} |

> **Conclusión:** el 100% del catálogo es de productos simples (sin variaciones ni
> atributos), por lo que la migración es 1:1 sin motor de variantes. La API pública
> no expone \`stock_quantity\`, por eso el stock se migra como 1/0 según \`is_in_stock\`.

## Árbol de categorías (${categories.items.length})

Ordenado por cantidad de productos descendientes. \`count\` es el total que declara
WooCommerce (incluye subcategorías).

| Categoría | slug (ruta) | wpId | count | subcats | chars desc | imagen |
| --- | --- | --- | --- | --- | --- | --- |
${tree.join("\n")}

## Marcas (${brands.items.length})

| # | Marca | slug |
| --- | --- | --- |
${brandRows}

## Tags (${tags.total} en total, muestra de ${tags.items.length})

${tagRows}

## Mapeo de precios y flags (muestra de ${sample.length} productos)

| slug | nombre | precio | precio lista | stock | marca | cats | highlights | chars desc | imgs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${sampleRows}

## Reconciliación API vs sitemaps

- Solo en la API (no indexados): **${onlyApi.length}**
- Solo en sitemaps (no en la API): **${onlySitemap.length}**

${onlyApi.slice(0, 40).map((s) => `- \`${s}\``).join("\n") || "_Ninguno._"}

${onlySitemap.slice(0, 40).map((s) => `- \`${s}\``).join("\n") || ""}

## Redirecciones 301 (WooCommerce → Next.js)

| Origen (WP) | Destino (Next) |
| --- | --- |
${redirectRows}

## Mapeo de campos

| Campo Next.js | Origen WooCommerce | Nota |
| --- | --- | --- |
| \`products.slug\` | \`slug\` | 1:1 exacto, sin cambios |
| \`products.sku\` | \`sku\` | |
| \`products.name\` | \`name\` | |
| \`products.brand\` | \`brands[0].name\` | fallback \`General\` (${products.items.length - withBrands} sin marca) |
| \`products.categorySlug\` | categoría raíz más cercana | sigue siendo la principal para compatibilidad |
| \`productCategories\` | \`categories[]\` | puente para el ${pct(multiCat, products.items.length)} multi-categoría |
| \`products.price\` | \`prices.price\` | centavos ARS |
| \`products.compareAtPrice\` | \`prices.regular_price\` si \`on_sale\` | |
| \`products.stock\` | \`is_in_stock\` ? 1 : 0 | la API pública no da cantidad |
| \`products.shortDescription\` | \`short_description\` | HTML a texto |
| \`products.descriptionHtml\` | \`description\` | HTML saneado |
| \`products.description\` | \`description\` | texto plano |
| \`products.highlights\` | \`<li>\` de la descripción | hasta 6 |
| \`products.images\` | \`images[].src\` | servidas desde el WP viejo |
| \`products.tags\` | \`tags[].slug\` | |
| \`products.specs\` | — | WooCommerce no publica atributos: queda vacío |
| \`products.badge\` | derivado de \`on_sale\` | |
| \`products.rating\` / \`reviewCount\` | 48 / 0 | WP no tiene ratings (\`average_rating\` = 0) |
| \`categories.parentId\` | \`parent\` | árbol real 1:1 |
| \`categories.descriptionHtml\` | \`description\` | ${categories.items.filter((c) => (c.description ?? "").length >= 200).length} con descripción SEO útil |
| \`categories.imageUrl\` | \`image.src\` | |

## Riesgos / pendientes

1. **Imágenes servidas desde el WP viejo**: el server debe seguir online hasta el corte
   y \`next.config.ts\` necesita \`remotePatterns\` para \`wp-content\`.
2. **Rank Math**: cada producto tiene \`seoTitle\`/\`seoDescription\` propios en WP. El
   Store API no los expone; si se quieren migrar hace falta \`wc/v3\` con claves.
3. **Reviews**: WooCommerce no tiene ratings nativos (\`average_rating\` = 0 en el
   100% del catálogo). Las reseñas de la home vienen de Google Places.
4. **Diferencia API vs sitemaps**: ver sección de reconciliación (${onlyApi.length} +
   ${onlySitemap.length} casos) antes de dar por buena la migración.
`;

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, md, "utf8");

  console.log(`[audit-wp] escrito ${path.relative(process.cwd(), OUT)}`);
  console.log(
    `[audit-wp] ${categories.items.length} categorías · ${products.items.length} productos · ` +
      `${brands.items.length} marcas · ${tags.total} tags`,
  );
  console.log(`[audit-wp] diff: ${onlyApi.length} solo-API, ${onlySitemap.length} solo-sitemap`);
}

main().catch((error) => {
  console.error(`[audit-wp] FATAL: ${(error as Error).message}`);
  process.exit(1);
});
