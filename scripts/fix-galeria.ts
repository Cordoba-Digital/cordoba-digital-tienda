/**
 * Rellena la galería de productos que ya existen pero quedaron con una sola
 * imagen o sin `srcset`.
 *
 * Por qué existe: la primera versión de `sync-precios` creaba los productos
 * nuevos guardando solo `images[0].src` y `imageSrcSets: []`. El producto
 * `macbook-air-m5-15-24gb-1tb-midnight` quedó así: una miniatura y sin galería,
 * cuando WooCommerce publica 3 fotos. El script ya usa `buildGallery`, pero el
 * producto quedó escrito con la versión anterior y hay que repararlo.
 *
 * Solo escribe `images` e `image_srcsets` de los productos que intersectan.
 * No toca precios, stock, categorías ni descripciones.
 *
 * Uso:
 *   npm run fix:galeria -- --dry-run
 *   npm run fix:galeria -- --slug=macbook-air-m5-15-24gb-1tb-midnight
 *   npm run fix:galeria
 */
import "dotenv/config";

import { eq, sql } from "drizzle-orm";

import { products } from "@/db/schema";
import { buildGallery, type WPImage } from "./lib/wp-images";

const STORE_URL = (process.env.WC_STORE_URL ?? "https://www.cordobadigital.net").replace(/\/+$/, "");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const argv = process.argv.slice(2);
const dryRun = !argv.includes("--apply");
const slugArg = argv.find((a) => a.startsWith("--slug="));
const soloSlug = slugArg ? slugArg.split("=")[1] : null;

type StoreProduct = { slug: string; images?: WPImage[] };

async function fetchOne(slug: string): Promise<StoreProduct | null> {
  const res = await fetch(
    `${STORE_URL}/wp-json/wc/store/v1/products?slug=${encodeURIComponent(slug)}`,
    { headers: { "user-agent": UA }, signal: AbortSignal.timeout(30_000) },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${slug}`);
  const items = (await res.json()) as StoreProduct[];
  return items[0] ?? null;
}

async function main() {
  const { db } = await import("@/db");

  // Solo los que están ROTOS, no los que legítimamente tienen una sola foto:
  // 443 productos del catálogo tienen una única imagen en WooCommerce, y en
  // esos `1 img / 1 sets` ya está bien. Lo que hay que reparar es cuando el
  // srcset falta o no está alineado con la galería.
  const candidatos = await db.execute<{ slug: string; n_imgs: number; n_sets: number }>(sql`
    SELECT slug,
           jsonb_array_length(images) AS n_imgs,
           jsonb_array_length(COALESCE(image_srcsets, '[]'::jsonb)) AS n_sets
    FROM products
    WHERE jsonb_array_length(COALESCE(image_srcsets, '[]'::jsonb)) <> jsonb_array_length(images)
       OR (jsonb_array_length(COALESCE(image_srcsets, '[]'::jsonb)) = 0 AND jsonb_array_length(images) > 0)
      ${soloSlug ? sql`AND slug = ${soloSlug}` : sql``}
    ORDER BY slug`);

  const lista = candidatos.rows;
  console.log(
    `[fix] ${dryRun ? "DRY RUN" : "ESCRIBIENDO"} · ${lista.length} producto(s) con galería incompleta`,
  );
  if (!lista.length) {
    console.log("[fix] nada que hacer.");
    return;
  }

  let arreglados = 0;
  for (const row of lista) {
    const remoto = await fetchOne(row.slug);
    if (!remoto) {
      console.log(`  [skip] ${row.slug}: no está en WooCommerce`);
      continue;
    }
    const { urls, srcSets } = buildGallery(remoto.images);
    if (!urls.length) {
      console.log(`  [skip] ${row.slug}: WooCommerce no publica imágenes`);
      continue;
    }

    console.log(
      `  ${row.slug}: ${row.n_imgs} img / ${row.n_sets} sets  ->  ${urls.length} img / ${srcSets.length} sets`,
    );
    for (const [i, u] of urls.entries()) {
      console.log(`      [${i}] ${u.split("/").pop()}  (${srcSets[i].length} variantes)`);
    }

    if (!dryRun) {
      await db.update(products).set({ images: urls, imageSrcSets: srcSets }).where(eq(products.slug, row.slug));
    }
    arreglados += 1;
  }

  console.log(`\n[fix] ${arreglados} producto(s) ${dryRun ? "a corregir" : "corregidos"}`);
  if (dryRun) console.log("[fix] dry run: no se escribió nada. Usá --apply para escribir.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[fix] falló:", error);
    process.exit(1);
  });
