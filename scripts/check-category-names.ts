/**
 * Prueba de `titleCaseCategoryName` contra los nombres reales de la base.
 *
 * Se prueba contra el catálogo y no contra una lista inventada porque los casos
 * raros vienen de los nombres que puso el cliente: abreviaturas con dígito
 * ("5G"), signos pegados ("P/"), guiones y acentos. Inventando ejemplos se
 * garantiza cubrir solo los que existen.
 */
import { sql } from "drizzle-orm";

import { db } from "../src/db";
import { titleCaseCategoryName } from "../src/lib/category-tree";

/**
 * Casos que el helper tiene que clavar. Salen del catálogo real, no inventados:
 * cada linea es un nombre que existe en la base y la forma que tiene que dar.
 */
const ESPERADOS: [string, string][] = [
  ["ACCESORIOS P/ CELULARES", "Accesorios P/ Celulares"],
  ["AUDIO Y VIDEO", "Audio y Video"],
  ["CAMARAS CCTV - SEGURIDAD", "Camaras CCTV - Seguridad"],
  ["Cables USB", "Cables USB"],
  ["CONSOLAS PLAYSTATION", "Consolas PlayStation"],
  ["Disco SSD / HDD", "Disco SSD / HDD"],
  ["ESTABILIZADORES- UPS", "Estabilizadores- UPS"],
  ["TELEVISORES - SMART TV", "Televisores - Smart TV"],
  ["Impresoras 3D", "Impresoras 3D"],
  ["Computadoras AMD", "Computadoras AMD"],
  ["Notebooks HP", "Notebooks HP"],
  ["Celulares 5G", "Celulares 5G"],
  ["Access Point", "Access Point"],
  ["COMPUTACIÓN", "Computación"],
];

async function main() {
  const filas = await db.execute(sql`select name from categories order by name`);
  const nombres = (filas.rows as { name: string }[]).map((r) => r.name);

  console.log(`nombres en la base: ${nombres.length}\n`);

  // 1. Los casos que deben dar exactamente tal cual.
  console.log("casos fijos:");
  let fallos = 0;
  for (const [entrada, esperado] of ESPERADOS) {
    const salida = titleCaseCategoryName(entrada);
    const ok = salida === esperado;
    if (!ok) fallos += 1;
    console.log(`  ${ok ? "ok  " : "FALLA"} ${entrada.padEnd(30)} -> ${salida}${ok ? "" : `  (esperado: ${esperado})`}`);
  }

  // 2. Sobre todo el catálogo: la transformation solo puede cambiar el case.
  console.log("\nsobre los 128 nombres:");
  for (const original of nombres) {
    const salida = titleCaseCategoryName(original);
    if (original.toLowerCase() !== salida.toLowerCase()) {
      console.log(`  REVISAR  "${original}" -> "${salida}"  (cambia más que el case)`);
      fallos += 1;
    }
  }

  console.log(`\n${fallos === 0 ? "TODO OK" : `${fallos} FALLOS`}`);

  console.log("\nmuestra:");
  for (const n of nombres.slice(0, 20)) {
    console.log(`  ${n.padEnd(38)} -> ${titleCaseCategoryName(n)}`);
  }

  process.exit(fallos === 0 ? 0 : 1);
}

void main();
