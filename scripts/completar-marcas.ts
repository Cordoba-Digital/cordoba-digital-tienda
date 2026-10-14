/**
 * Completa la marca de los productos que quedaron como "General" (o vacía)
 * leyéndola del nombre: "Monopatin Electrico Daihatsu V101" → Daihatsu. Sin
 * marca, el producto no aparece en el filtro de marca ni en los atajos del
 * buscador.
 *
 * Usa la lista de `src/lib/brand-from-name.ts` más las marcas que ya tiene el
 * catálogo, y respeta la forma en que ya están escritas. Solo toca productos
 * con marca de relleno; los que ya tienen una marca no se cambian.
 *
 * Uso:
 *   npm run marcas                          # modo prueba: muestra el plan, no escribe
 *   npm run marcas -- --csv marcas.csv      # además deja el detalle producto por producto
 *   npm run marcas -- --apply               # escribe todo en una transacción
 *
 * Es idempotente: correrlo de nuevo solo agarra lo que siga como "General".
 */
import "dotenv/config";

import { writeFileSync } from "node:fs";

import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { products } from "@/db/schema";
import { crearDetectorDeMarca, esMarcaDeRelleno } from "@/lib/brand-from-name";

const MOSTRAR_SIN_MARCA = 80;

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const csvIndex = process.argv.indexOf("--csv");
  const csvPath = csvIndex > 0 ? process.argv[csvIndex + 1] : null;
  const { db, pool } = await import("@/db");

  const filas = await db.select({ id: products.id, name: products.name, brand: products.brand }).from(products);
  const catalogo = [...new Set(filas.map((f) => f.brand).filter((b) => !esMarcaDeRelleno(b)))];
  const detectar = crearDetectorDeMarca(catalogo);

  const pendientes = filas.filter((f) => esMarcaDeRelleno(f.brand));
  const porMarca = new Map<string, { id: number; name: string }[]>();
  const sinMarca: string[] = [];
  const detalle: string[][] = [["id", "nombre", "marca_actual", "marca_nueva"]];
  for (const f of pendientes) {
    const marca = detectar(f.name);
    detalle.push([String(f.id), f.name, f.brand ?? "", marca ?? ""]);
    if (!marca) {
      sinMarca.push(f.name);
      continue;
    }
    const grupo = porMarca.get(marca) ?? [];
    grupo.push(f);
    porMarca.set(marca, grupo);
  }

  const completados = pendientes.length - sinMarca.length;
  console.log(`\n[marcas] ${filas.length} productos, ${pendientes.length} sin marca (General o vacía).`);
  console.log(`[marcas] Se completan ${completados}; quedan ${sinMarca.length} sin marca reconocible.\n`);
  const grupos = [...porMarca.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [marca, items] of grupos) {
    console.log(`  ${marca.padEnd(18)} ${String(items.length).padStart(4)}   ej.: ${items[0].name}`);
  }
  if (sinMarca.length) {
    console.log(`\n[marcas] Sin marca reconocible (primeros ${Math.min(MOSTRAR_SIN_MARCA, sinMarca.length)}):`);
    for (const nombre of sinMarca.slice(0, MOSTRAR_SIN_MARCA)) console.log(`      - ${nombre}`);
  }
  if (csvPath) {
    const csv = detalle.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    writeFileSync(csvPath, `${csv}\n`);
    console.log(`\n[marcas] Detalle en ${csvPath}`);
  }

  if (!apply) {
    console.log("\n[marcas] modo prueba: no se escribió nada. Para aplicar: npm run marcas -- --apply");
    await pool.end();
    return;
  }

  // Solo se pisa una marca de relleno, por si alguien la cargó a mano mientras tanto.
  const valores = [...new Set(pendientes.map((f) => f.brand).filter((b): b is string => Boolean(b)))];
  const relleno = or(isNull(products.brand), valores.length ? inArray(products.brand, valores) : undefined);
  await db.transaction(async (tx) => {
    for (const [marca, items] of grupos) {
      await tx
        .update(products)
        .set({ brand: marca, updatedAt: sql`now()` })
        .where(and(inArray(products.id, items.map((i) => i.id)), relleno));
    }
  });
  console.log(`[marcas] listo: ${completados} productos con marca. Los filtros y el buscador lo toman en hasta 5 minutos (caché).`);
  await pool.end();
}

if (process.argv[1]?.endsWith("completar-marcas.ts")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
