/**
 * Verifica que las columnas que usa el codigo existan en la base.
 *
 * El commit anterior agrego `products.image_srcsets` (un srcset por foto, en vez
 * de un array plano mezclado). Si la columna no esta creada, cualquier consulta
 * a productos revienta con "column does not exist" y el sitio entero cae, sin
 * que el build lo detecte: TypeScript no valida contra la base.
 */
import { sql } from "drizzle-orm";

import { db } from "../src/db";

async function main() {
  const filas = await db.execute(sql`
    select table_name, column_name, data_type
    from information_schema.columns
    where table_name = 'products'
      and column_name in ('image_srcset', 'image_srcsets', 'images')
    order by column_name
  `);

  console.log("columnas de products relacionadas con imagenes:");
  const columnas = filas.rows as { column_name: string; data_type: string }[];
  for (const f of columnas) {
    console.log(`  ${f.column_name.padEnd(16)} ${f.data_type}`);
  }

  const nombres = columnas.map((r) => r.column_name);
  const falta = !nombres.includes("image_srcsets");
  console.log("");
  console.log(
    falta
      ? "FALTA image_srcsets: hay que correr la migracion y el backfill antes de que falle el sitio."
      : "image_srcsets existe.",
  );
  if (falta) {
    console.log("  1) npx drizzle-kit push");
    console.log("  2) npx tsx scripts/backfill-image-srcsets.ts");
  }
  process.exit(falta ? 1 : 0);
}

void main();
