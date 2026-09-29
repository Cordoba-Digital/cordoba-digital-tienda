/**
 * Lista los tokens en mayúsculas que aparecen dentro de los nombres, para
 * construir la lista de siglas a preservar a partir del catálogo real y no de
 * suposiciones.
 */
import { sql } from "drizzle-orm";

import { db } from "../src/db";

async function main() {
  const filas = await db.execute(sql`select name from categories`);
  const nombres = (filas.rows as { name: string }[]).map((r) => r.name);

  const conteo = new Map<string, string[]>();
  for (const nombre of nombres) {
    for (const token of nombre.split(/[\s\-/&]+/)) {
      const limpio = token.replace(/[^A-Za-z0-9]/g, "");
      // Solo los que estan escritos en mayusculas y son cortos: candidatos a sigla.
      if (limpio.length < 2 || limpio.length > 8) continue;
      if (limpio !== limpio.toUpperCase()) continue;
      if (!/[A-Z]/.test(limpio)) continue;
      const lista = conteo.get(limpio) ?? [];
      lista.push(nombre);
      conteo.set(limpio, lista);
    }
  }

  console.log("tokens en mayusculas dentro de los nombres:\n");
  for (const [sigla, ejemplos] of [...conteo].sort()) {
    console.log(`  ${sigla.padEnd(12)} x${String(ejemplos.length).padEnd(3)} ${ejemplos[0]}`);
  }
}

void main();
