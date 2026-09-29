/**
 * Sincroniza el catálogo seed (src/lib/catalog-data.ts + catalog-new-*.ts)
 * con Postgres: inserta productos nuevos y actualiza los existentes
 * (imágenes, precios, stock, etc.) por slug. Nunca borra.
 *
 * Uso:
 *   npm run sync:catalog -- --dry-run   # valida sin escribir (no necesita DATABASE_URL)
 *   npm run sync:catalog                 # upsert real (requiere DATABASE_URL)
 */
import "dotenv/config";

import { existsSync } from "node:fs";
import { join } from "node:path";

import { products } from "@/db/schema";
import { seedProducts } from "@/lib/catalog-data";

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");

  // 1. Validaciones en memoria (también corren en modo real).
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const p of seedProducts) {
    if (seen.has(p.slug)) dupes.push(p.slug);
    seen.add(p.slug);
  }
  if (dupes.length > 0) {
    console.error(`[sync-catalog] slugs duplicados: ${dupes.join(", ")}`);
    process.exit(1);
  }

  const publicDir = join(process.cwd(), "public");
  let missingImages = 0;
  for (const p of seedProducts) {
    for (const src of p.images) {
      if (src.startsWith("/images/products/") && !existsSync(join(publicDir, src))) {
        missingImages += 1;
        console.error(`[sync-catalog] imagen faltante: '${src}' (producto '${p.slug}')`);
      }
    }
  }

  const withLocal = seedProducts.filter((p) => p.images.some((i) => i.startsWith("/images/products/")));
  console.log(
    `[sync-catalog] seed: ${seedProducts.length} productos (${withLocal.length} con foto local), ` +
      `${missingImages} imágenes faltantes.`,
  );
  if (missingImages > 0) {
    console.error("[sync-catalog] hay imágenes referenciadas que no existen en public/. Corregir antes del modo real.");
    process.exit(1);
  }

  if (dryRun) {
    console.log("[sync-catalog] --dry-run: no se escribió nada en la DB.");
    console.log(`[sync-catalog] Ejemplo: ${seedProducts.slice(-5).map((p) => p.slug).join(", ")}`);
    return;
  }

  // 2. Upsert real (import dinámico para no exigir DATABASE_URL en dry-run).
  const { db, pool } = await import("@/db");
  const { sql } = await import("drizzle-orm");

  // Guard: este script es del catálogo demo. Con el catálogo real de
  // WooCommerce cargado, insertarlo mezclaría productos de mentira.
  const [countRow] = await db.select({ count: sql<number>`count(*)::int` }).from(products);
  const productCount = countRow?.count ?? 0;
  if (productCount > 0) {
    console.error(
      `[sync-catalog] la base ya tiene ${productCount} productos (catálogo real de WooCommerce). ` +
        "Este script es solo para el seed demo: abortando para no mezclar catálogos. " +
        "Para el catálogo real usá `npm run migrate:wp`.",
    );
    await pool.end();
    process.exit(1);
  }

  let okProducts = 0;
  let failProducts = 0;
  for (const p of seedProducts) {
    try {
      await db
        .insert(products)
        .values({
          slug: p.slug,
          sku: p.sku,
          name: p.name,
          brand: p.brand,
          categorySlug: p.categorySlug,
          shortDescription: p.shortDescription,
          description: p.description,
          price: p.price,
          compareAtPrice: p.compareAtPrice ?? null,
          stock: p.stock,
          rating: p.rating,
          reviewCount: p.reviewCount,
          soldCount: p.soldCount,
          images: p.images,
          highlights: p.highlights,
          specs: p.specs,
          tags: p.tags,
          badge: p.badge ?? null,
          featured: p.featured ?? false,
          freeShipping: p.freeShipping ?? false,
          warrantyMonths: p.warrantyMonths,
        })
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
            compareAtPrice: p.compareAtPrice ?? null,
            stock: p.stock,
            images: p.images,
            highlights: p.highlights,
            specs: p.specs,
            tags: p.tags,
            badge: p.badge ?? null,
            featured: p.featured ?? false,
            freeShipping: p.freeShipping ?? false,
            warrantyMonths: p.warrantyMonths,
          },
        });
      okProducts += 1;
      if (okProducts % 50 === 0) console.log(`[sync-catalog] productos: ${okProducts}/${seedProducts.length}...`);
    } catch (error) {
      failProducts += 1;
      console.error(`[sync-catalog] ERROR upsert '${p.slug}': ${(error as Error).message}`);
    }
  }
  console.log(`[sync-catalog] Productos: ${okProducts} ok, ${failProducts} errores.`);

  // 3. Reseñas: no se siembran. Este bloque usaba `reviewsForProduct()`, que
  // repartía seis reseñas de clientes inventados entre los productos y las
  // guardaba con `verified: true`. Llenó la tienda de testimonios falsos.
  // Las reseñas reales vienen de Google (Places) o las carga el cliente.

  await pool.end();
}

main().catch(async (error) => {
  console.error(`[sync-catalog] FATAL: ${(error as Error).message}`);
  try {
    const { pool } = await import("@/db");
    await pool.end();
  } catch {
    // sin DB (dry-run) o pool ya cerrado
  }
  process.exit(1);
});
