/**
 * Rellena `products.image_srcsets` (y `products.images`) con un srcset por foto.
 *
 * Por qué existe aparte de `migrate:wp`: la columna nueva no se puede completar
 * con una migración completa, porque eso reescribiría precios, stock y
 * categorías de los 2.588 productos contra el estado actual de WooCommerce. Este
 * script **solo** lee `slug` + `images` de la Store API y escribe las dos
 * columnas de imagen. No toca ninguna otra columna.
 *
 * Contexto del bug que corrige: antes `image_srcset` era un único array plano
 * con las variantes de todas las fotos del producto mezcladas. La galería lo
 * pasaba a cada miniatura, el navegador elegía por ancho una variante que
 * podía ser de otra foto y todas las miniaturas mostraban la misma imagen.
 * Ahora hay un srcset por foto, alineado por índice con `images`.
 *
 * Uso:
 *   npm run backfill:srcsets -- --dry-run     # solo informa, no escribe
 *   npm run backfill:srcsets -- --limit=20    # prueba con 20 productos
 *   npm run backfill:srcsets                  # escribe todos
 *
 * Envs:
 *   WC_STORE_URL   (default https://www.cordobadigital.net)
 *   DATABASE_URL   requerido
 */
import "dotenv/config";

import { eq, sql } from "drizzle-orm";

import { products } from "@/db/schema";
import { buildGallery, type WPImage } from "./lib/wp-images";

const STORE_URL = (process.env.WC_STORE_URL ?? "https://www.cordobadigital.net").replace(/\/+$/, "");
/** El server WP bloquea requests sin UA moderno (403 "Your browser is outdated"). */
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const PER_PAGE = 100;
const CONCURRENCY = 2;
const TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;
const DB_BATCH = 50;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

type StoreProduct = { id: number; slug: string; images?: WPImage[] };

// ─── CLI ─────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const limitArg = argv.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : NaN;
const maxProducts = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : null;

// ─── Fetch ───────────────────────────────────────────────────────────

async function fetchPage(page: number): Promise<{ items: StoreProduct[]; total: number }> {
  const url = `${STORE_URL}/wp-json/wc/store/v1/products?per_page=${PER_PAGE}&page=${page}`;
  let lastMessage = "desconocido";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": UA, accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const total = Number(res.headers.get("x-wp-total") ?? 0);
      const items = (await res.json()) as StoreProduct[];
      if (!Array.isArray(items)) throw new Error("respuesta no es un array");
      return { items, total };
    } catch (error) {
      lastMessage = (error as Error).message;
      if (attempt < MAX_ATTEMPTS) {
        const backoff = 500 * 2 ** (attempt - 1);
        console.error(`[backfill] página ${page}: ${lastMessage} — reintento ${attempt + 1}/${MAX_ATTEMPTS}`);
        await sleep(backoff);
      }
    }
  }
  throw new Error(`página ${page}: ${lastMessage}`);
}

async function fetchAll(): Promise<StoreProduct[]> {
  const first = await fetchPage(1);
  const total = first.total || first.items.length;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const items: StoreProduct[] = [...first.items];
  let errors = 0;

  let nextPage = 2;
  const worker = async (): Promise<void> => {
    for (;;) {
      const page = nextPage++;
      if (page > totalPages) return;
      try {
        const { items: data } = await fetchPage(page);
        if (data.length) items.push(...data);
        process.stdout.write(`\r  página ${page}/${totalPages} · ${items.length}/${total}   `);
      } catch (error) {
        errors += 1;
        console.error(`\n[backfill] página ${page} falló: ${(error as Error).message} (sigo)`);
      }
    }
  };

  const workers = Array.from({ length: Math.min(CONCURRENCY, Math.max(totalPages - 1, 1)) }, worker);
  await Promise.all(workers);
  process.stdout.write("\n");

  if (errors) console.error(`[backfill] ${errors} páginas fallaron: esos productos conservan el valor anterior.`);
  items.sort((a, b) => Number(a.id ?? 0) - Number(b.id ?? 0));
  return maxProducts ? items.slice(0, maxProducts) : items;
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  const { db } = await import("@/db");

  console.log(`[backfill] ${dryRun ? "DRY RUN (no escribe)" : "escribiendo"} · destino ${STORE_URL}`);
  const remote = await fetchAll();
  console.log(`[backfill] ${remote.length} productos leídos de WooCommerce`);

  type Row = { slug: string; urls: string[]; srcSets: string[][] };
  const rows: Row[] = [];
  let sinImagenes = 0;

  for (const p of remote) {
    const { urls, srcSets } = buildGallery(p.images);
    if (!urls.length) sinImagenes += 1;
    rows.push({ slug: p.slug, urls, srcSets });
  }

  // Sanity check local: cada srcset debe contener solo variantes de la foto de
  // su índice. Si esto falla, el arreglo del bug original no serviría de nada.
  const baseOf = (url: string): string => url.replace(/-\d+x\d+(?=\.[a-z0-9]+$)/i, "");
  let desalineados = 0;
  let conFugas = 0;
  for (const row of rows) {
    if (row.srcSets.length !== row.urls.length) desalineados += 1;
    row.srcSets.forEach((srcSet, i) => {
      const own = baseOf(row.urls[i]);
      if (srcSet.some((entry) => baseOf(entry.split(/\s+/)[0]) !== own)) conFugas += 1;
    });
  }

  console.log(`[backfill] productos sin ninguna foto: ${sinImagenes}`);
  console.log(`[backfill] srcsets desalineados con images: ${desalineados}`);
  console.log(`[backfill] srcsets con variantes de otra foto: ${conFugas}`);

  if (dryRun) {
    const muestra = rows.slice(0, 3);
    for (const row of muestra) {
      console.log(`\n  ${row.slug}`);
      row.urls.forEach((url, i) => {
        console.log(`    [${i}] ${url.split("/").pop()}`);
        console.log(`         srcset: ${row.srcSets[i].length} variantes`);
      });
    }
    console.log("\n[backfill] dry run: no se escribió nada.");
    return;
  }

  let written = 0;
  let missing = 0;
  for (let i = 0; i < rows.length; i += DB_BATCH) {
    const batch = rows.slice(i, i + DB_BATCH);
    for (const row of batch) {
      const res = await db
        .update(products)
        .set({ images: row.urls, imageSrcSets: row.srcSets, imageSrcSet: [] })
        .where(eq(products.slug, row.slug));
      if (res.rowCount && res.rowCount > 0) written += 1;
      else missing += 1;
    }
    process.stdout.write(`\r  escritos ${written}/${rows.length}   `);
  }
  process.stdout.write("\n");

  console.log(`[backfill] actualizados: ${written}`);
  if (missing) console.log(`[backfill] slugs no encontrados en la base: ${missing}`);

  const check = await db.execute(sql`
    SELECT count(*) FILTER (WHERE jsonb_array_length(image_srcsets) = jsonb_array_length(images)) AS alineados,
           count(*) FILTER (WHERE jsonb_array_length(image_srcsets) > 0)              AS con_srcset,
           count(*)                                                                    AS total
    FROM products`);
  console.log("[backfill] verificación:", check.rows[0]);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[backfill] falló:", error);
    process.exit(1);
  });
