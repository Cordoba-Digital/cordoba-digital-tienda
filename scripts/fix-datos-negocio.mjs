/**
 * Corrige la dirección y los horarios del negocio, que estaban mal.
 *
 * La dirección estaba inventada. El sitio original la publica en el pie de la
 * home y en /contacto/: "27 de abril 180". Lo que se imprimia, "27 de Abril
 * 259", no aparece en ninguna parte del original: el 259 sí existe en la home
 * del sitio viejo, pero solo dentro de precios (1.259.999, 259.999).
 *
 * Los horarios del sábado también: el original dice "Lunes a Viernes de 14 a
 * 18:30hs y Sábados de 12 a 14:30hs", y en shipping.ts estaba "Sáb 11 a 14".
 *
 * El código postal 5000 sale del JSON-LD de la home. El original no publica
 * ningún código postal, así que se saca en vez de inventarlo: un `postalCode`
 * equivocado en los datos estructurados es peor que no tenerlo.
 *
 * La query de Google Places también llevaba la dirección vieja, con lo cual la
 * búsqueda daba error aunque la API key funcionara.
 *
 * Uso: node scripts/fix-datos-negocio.mjs [--escribir]
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const escribir = process.argv.includes("--escribir");

/** [viejo, nuevo, cuántas apariciones se esperan en total] */
const REGLAS = [
  ["27 de Abril 259", "27 de Abril 180", 20],
  ["27+de+Abril+259", "27+de+Abril+180", 1],
  ["Lun a Vie 14 a 18:30, Sáb 11 a 14", "Lun a Vie 14 a 18:30, Sáb 12 a 14:30", 1],
];

function archivos(dir, acc = []) {
  for (const entrada of readdirSync(dir)) {
    const p = join(dir, entrada);
    if (entrada === "node_modules" || entrada.startsWith(".git") || entrada === ".next") continue;
    if (statSync(p).isDirectory()) archivos(p, acc);
    else if (/\.tsx?$/.test(entrada)) acc.push(p);
  }
  return acc;
}

const cambios = [];
let fallas = 0;

for (const ruta of archivos("src")) {
  const antes = readFileSync(ruta, "utf8");
  let despues = antes;
  for (const [viejo, nuevo] of REGLAS) {
    if (!despues.includes(viejo)) continue;
    const n = despues.split(viejo).length - 1;
    despues = despues.split(viejo).join(nuevo);
    cambios.push({ ruta, viejo, nuevo, n });
  }
  if (despues !== antes && escribir) writeFileSync(ruta, despues, "utf8");
}

for (const c of cambios) {
  console.log(`${c.ruta}  ${c.n} x  "${c.viejo}" -> "${c.nuevo}"`);
}

const total = cambios.filter((c) => c.viejo === "27 de Abril 259").reduce((a, c) => a + c.n, 0);
const mapas = cambios.filter((c) => c.viejo === "27+de+Abril+259").reduce((a, c) => a + c.n, 0);
const horarios = cambios.filter((c) => c.viejo.startsWith("Lun a Vie")).reduce((a, c) => a + c.n, 0);

console.log(`\ndirección: ${total} (se esperaban 20) · link de maps: ${mapas} (se esperaba 1) · horarios: ${horarios} (se esperaba 1)`);
if (total !== 20 || mapas !== 1 || horarios !== 1) {
  console.error("alguna cantidad no coincide: revisa si ya estaba corregido en algún archivo");
  fallas = 1;
}
if (fallas && escribir) {
  console.error("no se escribió nada");
  process.exitCode = 1;
} else if (escribir) {
  console.log("escrito");
}
