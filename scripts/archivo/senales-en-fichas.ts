/**
 * Cuenta cuántos productos del catálogo show cada señal en la ficha: el badge
 * "Oferta", la línea de SKU y la marca en las migas.
 *
 * El motivo: una señal que aparece en casi todos los productos no informa nada,
 * y si además es urgencia o escasez es peor. Con este número se decide sin
 * adivinar.
 *
 * Uso: npx tsx scripts/senales-en-fichas.ts
 */
import { count, eq, gt, isNotNull, ne, sql } from "drizzle-orm";

import { db } from "../../src/db";
import { products } from "../../src/db/schema";

async function main() {
  const total = (await db.select({ n: count() }).from(products))[0].n;

  const conOferta = (
    await db.select({ n: count() }).from(products).where(eq(products.badge, "Oferta"))
  )[0].n;

  // Ojo: `isNotNull` no alcanza, hay SKU que son cadena vacía. La ficha imprime
  // "SKU {sku}" y con el vacío queda un "SKU " pelado.
  const conSku = (
    await db.select({ n: count() }).from(products).where(ne(products.sku, ""))
  )[0].n;

  const conMarcaDistinta = (
    await db
      .select({ n: count() })
      .from(products)
      .where(sql`brand is not null and brand <> '' and brand <> 'General'`)
  )[0].n;

  const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`;

  console.log(`productos: ${total}\n`);
  console.log(`badge "Oferta" en la foto:  ${conOferta} (${pct(conOferta)})`);
  console.log(`línea de SKU:               ${conSku} (${pct(conSku)})`);
  console.log(`marca real (no "General"):   ${conMarcaDistinta} (${pct(conMarcaDistinta)})`);
  console.log(`\nA los que les falta el SKU: ${total - conSku}`);

  const sinSku = await db
    .select({ slug: products.slug, name: products.name })
    .from(products)
    .where(sql`sku is null or sku = ''`)
    .limit(5);
  for (const r of sinSku) console.log(`   ${r.slug}`);
}

main().catch((e) => {
  console.error(`ERROR: ${e.message}`);
  process.exitCode = 1;
});
