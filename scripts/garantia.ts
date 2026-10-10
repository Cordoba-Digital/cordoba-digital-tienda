/**
 * Pasa a 6 meses la garantía de los productos que quedaron con 12.
 *
 * `migrate:wp` cargó `warrantyMonths: 12` en todo el catálogo, pero la política
 * de la tienda es 6 meses (Ley 24.240, ver /politica-de-garantia). La ficha
 * muestra ese número en "Garantía" y en "meses de garantía legal".
 *
 * Uso:
 *   npm run garantia            # modo prueba: cuenta cuántos productos cambian
 *   npm run garantia -- --apply # los actualiza
 *
 * Envs: DATABASE_URL (requerida)
 */
import "dotenv/config";

import { eq, sql } from "drizzle-orm";

import { products } from "@/db/schema";

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const { db, pool } = await import("@/db");
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(products)
    .where(eq(products.warrantyMonths, 12));

  if (!apply) {
    console.log(`[garantia] modo prueba: ${total} productos tienen 12 meses y pasarían a 6. Para aplicar: npm run garantia -- --apply`);
  } else {
    await db.update(products).set({ warrantyMonths: 6, updatedAt: sql`now()` }).where(eq(products.warrantyMonths, 12));
    console.log(`[garantia] ${total} productos pasaron de 12 a 6 meses. La tienda lo muestra en hasta 5 minutos (caché).`);
  }
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
