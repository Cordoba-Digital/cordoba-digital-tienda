/**
 * Prueba de `titleCaseCategoryName` contra los nombres reales de la base.
 *
 * Se prueba contra el catálogo y no contra una lista inventada porque los casos
 * raros vienen de los nombres que puso el cliente: abreviaturas con dígito
 * ("5G"), signos pegados ("P/"), guiones, tildes perdidas y una conjunción que
 * WooCommerce se comió. Inventando ejemplos se garantiza cubrir solo los que
 * existen.
 */
import { sql } from "drizzle-orm";

import { db } from "../src/db";
import { titleCaseCategoryName } from "../src/lib/category-tree";

/**
 * Casos que el helper tiene que clavar. Salen del catálogo real, no inventados:
 * cada linea es un nombre que existe en la base y la forma que tiene que dar.
 *
 * Los nombres con tilde ya resuelta ("COMPUTACIÓN", "PAVAS ELÉCTRICAS",
 * "Cámaras de seguridad Wi-Fi") están a propósito: el arreglo de tildes no
 * puede romper los que ya venían bien.
 */
const ESPERADOS: [string, string][] = [
  ["ACCESORIOS P/ CELULARES", "Accesorios P/ Celulares"],
  ["AUDIO Y VIDEO", "Audio y Video"],
  ["CAMARAS CCTV - SEGURIDAD", "Cámaras CCTV - Seguridad"],
  ["CAMARAS DIGITALES FOTO", "Cámaras Digitales y Foto"],
  ["Camaras Compactas", "Cámaras Compactas"],
  ["Camaras Reflex y Mirrorless", "Cámaras Reflex y Mirrorless"],
  // La marca "GoPro" sale como "Gopro": el case interno de las marcas no es
  // parte del arreglo de tildes, asi que aca se afirma lo que hay hoy y no lo
  // que idealmente seria. Queda anotado como pendiente aparte.
  ["Camaras GoPro", "Cámaras Gopro"],
  ["Camaras Semi-Reflex / Bridge", "Cámaras Semi-Reflex / Bridge"],
  ["ELECTRODOMESTICOS", "Electrodomésticos"],
  ["ELECTRONICA", "Electrónica"],
  ["CALEFACCION", "Calefacción"],
  ["MONOPATINES ELECTRICOS", "Monopatines Eléctricos"],
  ["PAVAS ELÉCTRICAS", "Pavas Eléctricas"],
  ["Cámaras de seguridad Wi-Fi", "Cámaras De Seguridad Wi-Fi"],
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

/**
 * El árbol entero se arma en memoria y son 128 filas (ver category-tree.ts), así
 * que un número distinto es una señal de que el catálogo cambió y esta prueba
 * hay que revisarla, no de que el helper anda mal.
 */
const TOTAL_ESPERADO = 128;

/** Sin tildes y en minúscula: así se comparan los nombres sin el case. */
function sinTilde(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** Cuántas tildes tiene el texto, para poder contar las que se agregaron. */
function cantidadDeTildes(texto: string): number {
  return (texto.normalize("NFD").match(/\p{Diacritic}/gu) ?? []).length;
}

async function main() {
  const filas = await db.execute(sql`select name from categories order by name`);
  const nombres = (filas.rows as { name: string }[]).map((r) => r.name);

  console.log(`nombres en la base: ${nombres.length}\n`);

  let fallos = 0;
  if (nombres.length !== TOTAL_ESPERADO) {
    console.log(`  FALLA hay ${nombres.length} nombres y se esperaban ${TOTAL_ESPERADO}`);
    fallos += 1;
  }

  // 1. Los casos que deben dar exactamente tal cual.
  console.log("casos fijos:");
  for (const [entrada, esperado] of ESPERADOS) {
    const salida = titleCaseCategoryName(entrada);
    const ok = salida === esperado;
    if (!ok) fallos += 1;
    console.log(`  ${ok ? "ok  " : "FALLA"} ${entrada.padEnd(30)} -> ${salida}${ok ? "" : `  (esperado: ${esperado})`}`);
  }

  // 2. Sobre todo el catálogo: el helper solo puede cambiar el case y la tilde.
  console.log("\nsobre los 128 nombres:");
  let conTildeNueva = 0;
  for (const original of nombres) {
    const salida = titleCaseCategoryName(original);

    // El case y la tilde no cuentan como cambio de contenido: se comparan las
    // palabras sin tilde. Lo único que se puede agregar es la conjunción "y",
    // que es la palabra que WooCommerce se comió en "CAMARAS DIGITALES FOTO".
    const crudas = sinTilde(original).split(" ").filter(Boolean);
    const finales = sinTilde(salida).split(" ").filter(Boolean);
    const perdidas = crudas.filter((w) => !finales.includes(w));
    const agregadas = finales.filter((w) => !crudas.includes(w));
    const soloConjuncion = agregadas.every((w) => w === "y");
    if (perdidas.length > 0 || agregadas.length > 0 && !soloConjuncion) {
      console.log(`  REVISAR  "${original}" -> "${salida}"  (cambia más que el case y la tilde)`);
      fallos += 1;
    }

    // Normalizar dos veces tiene que dar lo mismo: si la tilde se volviera a
    // tocar o el "y" se duplicara, esto salta.
    if (titleCaseCategoryName(salida) !== salida) {
      console.log(`  REVISAR  "${original}" -> "${salida}" no es estable (2a vuelta cambia)`);
      fallos += 1;
    }

    if (cantidadDeTildes(salida) > cantidadDeTildes(original)) conTildeNueva += 1;
  }
  console.log(`  nombres a los que se les agrega una tilde: ${conTildeNueva}`);

  console.log(`\n${fallos === 0 ? "TODO OK" : `${fallos} FALLOS`}`);

  console.log("\nmuestra:");
  for (const n of nombres.slice(0, 20)) {
    console.log(`  ${n.padEnd(38)} -> ${titleCaseCategoryName(n)}`);
  }

  process.exit(fallos === 0 ? 0 : 1);
}

void main();
