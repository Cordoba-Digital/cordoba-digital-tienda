/**
 * Verificación del catálogo migrado contra WooCommerce.
 *
 * Compara lo que quedó en Postgres con lo que publica el WooCommerce real
 * (WC Store API pública) y escribe el resultado en `docs/CATALOGO-WP.md`
 * (sección "Estado de la migración") más un resumen por consola.
 *
 * Uso:
 *   npm run verify:wp
 *   npm run verify:wp -- --limit=3
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import "dotenv/config";

const STORE_URL = (process.env.WC_STORE_URL ?? "https://www.cordobadigital.net").replace(/\/+$/, "");
const PER_PAGE = 100;
const DOC = path.join(process.cwd(), "docs", "CATALOGO-WP.md");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

type WPCategory = { id: number; name: string; slug: string; parent: number; count: number };

async function apiAll<T>(endpoint: string, maxPages: number): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const res = await fetch(`${STORE_URL}/wp-json/wc/store/v1/${endpoint}?per_page=${PER_PAGE}&page=${page}`, {
      headers: { "user-agent": UA, accept: "application/json" },
    });
    if (!res.ok) throw new Error(`${endpoint} página ${page}: HTTP ${res.status}`);
    const batch = (await res.json()) as T[];
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < PER_PAGE) break;
  }
  return out;
}

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const maxPages = limitArg ? Number(limitArg.split("=")[1]) || 40 : 40;

  console.log(`[verify-wp] tienda: ${STORE_URL}`);
  const wpCats = await apiAll<WPCategory>("products/categories", 5);
  const wpProducts = await apiAll<{ slug: string; is_in_stock: boolean; on_sale: boolean; categories: { slug: string }[] }>(
    "products",
    maxPages,
  );
  console.log(`[verify-wp] WooCommerce: ${wpCats.length} categorías, ${wpProducts.length} productos`);

  const { db, pool } = await import("@/db");
  const { categories, productCategories, products } = await import("@/db/schema");
  const { count, eq, inArray } = await import("drizzle-orm");

  const dbCats = await db.select().from(categories);
  const dbProducts = await db.select({
    slug: products.slug,
    categorySlug: products.categorySlug,
    stock: products.stock,
    compareAtPrice: products.compareAtPrice,
  }).from(products);
  const links = await db.select().from(productCategories);

  const dbCatSlugs = new Set(dbCats.map((c) => c.slug));
  const wpCatSlugs = new Set(wpCats.map((c) => c.slug));
  const missingCats = [...wpCatSlugs].filter((s) => !dbCatSlugs.has(s));
  const extraCats = [...dbCatSlugs].filter((s) => !wpCatSlugs.has(s));

  const roots = wpCats.filter((c) => !c.parent);
  const byId = new Map(wpCats.map((c) => [c.id, c]));

  // La categoría principal que el migrador elige: la más cercana a la raíz.
  const depthOf = (c: WPCategory) => {
    let depth = 0;
    let cur = c;
    while (cur.parent) {
      cur = byId.get(cur.parent)!;
      depth++;
    }
    return depth;
  };
  const primaryOf = (p: { categories: { slug: string }[] }) => {
    let best: WPCategory | null = null;
    let bestDepth = 99;
    for (const { slug } of p.categories) {
      const cat = wpCats.find((c) => c.slug === slug);
      if (!cat) continue;
      const depth = depthOf(cat);
      if (depth < bestDepth) {
        bestDepth = depth;
        best = cat;
      }
    }
    return best?.slug ?? "general";
  };

  const mismatch: { slug: string; wp: string; db: string }[] = [];
  for (const p of wpProducts) {
    const row = dbProducts.find((d) => d.slug === p.slug);
    if (row && row.categorySlug !== primaryOf(p)) {
      mismatch.push({ slug: p.slug, wp: primaryOf(p), db: row.categorySlug });
    }
  }

  const inStockExpected = wpProducts.filter((p) => p.is_in_stock).length;
  const inStockDb = dbProducts.filter((p) => p.stock > 0).length;
  const onSaleExpected = wpProducts.filter((p) => p.on_sale).length;
  const onSaleDb = dbProducts.filter((p) => p.compareAtPrice != null).length;

  const lines = [
    "",
    "---",
    "",
    `## Estado de la migración (verificado ${new Date().toISOString().slice(0, 10)})`,
    "",
    `Reejecutá con \`npm run verify:wp\`. WooCommerce: ${wpProducts.length} productos / ${wpCats.length} categorías.`,
    "",
    "| Métrica | WooCommerce | Nuestra base | ¿Coincide? |",
    "| --- | --- | --- | --- |",
    `| Categorías | ${wpCats.length} | ${dbCats.length} | ${wpCats.length === dbCats.length ? "✅" : "❌"} |`,
    `| Productos | ${wpProducts.length} | ${dbProducts.length} | ${wpProducts.length === dbProducts.length ? "✅" : "❌"} |`,
    `| Con stock | ${inStockExpected} | ${inStockDb} | ${inStockExpected === inStockDb ? "✅" : "⚠️"} |`,
    `| En oferta | ${onSaleExpected} | ${onSaleDb} | ${onSaleExpected === onSaleDb ? "✅" : "⚠️"} |`,
    `| Categorías raíz | ${roots.length} | ${dbCats.filter((c) => !c.parentId).length} | ${roots.length === dbCats.filter((c) => !c.parentId).length ? "✅" : "❌"} |`,
    `| Puentes producto→categoría | — | ${links.length} | — |`,
    "",
    `Categorías de WooCommerce ausentes: **${missingCats.length}**${missingCats.length ? ` (${missingCats.slice(0, 10).join(", ")})` : ""}.`,
    "",
    `Categorías extra (no están en WooCommerce): **${extraCats.length}**${extraCats.length ? ` (${extraCats.slice(0, 10).join(", ")})` : ""}.`,
    "",
    `Productos con categoría principal distinta a la esperada: **${mismatch.length}**.`,
    ...(mismatch.length
      ? ["| producto | WooCommerce | Nuestra base |", "| --- | --- | --- |", ...mismatch.slice(0, 20).map((m) => `| \`${m.slug}\` | ${m.wp} | ${m.db} |`)]
      : []),
    "",
    "> `con stock` y `en oferta` se comparan contra lo que la API pública expone",
    "> (`is_in_stock`, `on_sale`); la API no da cantidades exactas por producto.",
    "",
  ];

  const marker = "\n---\n\n## Estado de la migración";
  let doc = "";
  try {
    doc = await readFile(DOC, "utf8");
  } catch {
    await writeFile(DOC, lines.join("\n"), "utf8");
    doc = lines.join("\n");
  }
  const cut = doc.indexOf(marker);
  const next = cut === -1 ? doc + lines.join("\n") : doc.slice(0, cut) + lines.join("\n");
  await writeFile(DOC, next, "utf8");

  console.log(`[verify-wp] base: ${dbProducts.length} productos, ${dbCats.length} categorías, ${links.length} puentes`);
  console.log(`[verify-wp] stock: WP ${inStockExpected} vs base ${inStockDb} | ofertas: WP ${onSaleExpected} vs base ${onSaleDb}`);
  console.log(`[verify-wp] categorías ausentes ${missingCats.length} · extra ${extraCats.length} · principal distinta ${mismatch.length}`);
  console.log(`[verify-wp] actualizado ${path.relative(process.cwd(), DOC)}`);

  await pool.end();
  if (missingCats.length || extraCats.length || mismatch.length) process.exitCode = 2;
}

main().catch((error) => {
  console.error(`[verify-wp] FATAL: ${(error as Error).message}`);
  process.exit(1);
});
