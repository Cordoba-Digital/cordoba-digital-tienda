/**
 * Reparte el catálogo por cantidad de unidades. Si la mayoría está en cero, la
 * demo muestra "Sin stock" en casi todas las fichas, y eso hay que saberlo
 * antes de mostrársela a un cliente.
 *
 * Uso: npx tsx scripts/distribucion-stock.ts
 */
import { count, eq, gt, sql } from "drizzle-orm";

import { db } from "../src/db";
import { products } from "../src/db/schema";

async function main() {
  const total = await db.select({ n: count() }).from(products);
  console.log(`productos en el catálogo: ${total[0].n}`);

  const conStock = await db.select({ n: count() }).from(products).where(gt(products.stock, 0));
  console.log(`con stock > 0:            ${conStock[0].n}`);

  const sinStock = await db.select({ n: count() }).from(products).where(eq(products.stock, 0));
  console.log(`con stock = 0:            ${sinStock[0].n}`);

  // El driver de neon devuelve las filas en una propiedad distinta segun la
  // version, asi que se.normaliza en vez de asumir una forma.
  const crudo = (await db.execute(sql`
    select case
             when stock = 0 then '0'
             when stock = 1 then '1'
             when stock between 2 and 5 then '2 a 5'
             when stock between 6 and 20 then '6 a 20'
             else '21 o mas'
           end as rango,
           count(*)::int as n
    from products
    group by 1
    order by min(stock)
  `)) as unknown as { rows?: unknown[] } | unknown[];

  const porRango = (Array.isArray(crudo) ? crudo : ((crudo as { rows?: unknown[] }).rows ?? [])) as {
    rango: string;
    n: number;
  }[];

  console.log("\ndistribución:");
  for (const r of porRango) console.log(`  ${String(r.rango).padEnd(9)} ${r.n}`);
}

main().catch((e) => {
  console.error(`ERROR: ${e.message}`);
  process.exitCode = 1;
});
