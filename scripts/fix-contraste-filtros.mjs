/**
 * Cambia `text-ink-400` por `text-ink-500` en los encabezados de los filtros.
 *
 * Sobre el panel de filtros (fondo `bg-ink-50`) el ink-400 daba 4,03:1 y el AA
 * pide 4,5:1 para texto normal, así que "Categoría", "Marca", "Precio" y
 * "Beneficios" quedaban apenas por debajo del mínimo. Son 12px en negrita, que
 * no cuentan como texto grande (para eso hacen falta 18,66px).
 *
 * Uso: node scripts/fix-contraste-filtros.mjs [--escribir]
 */
import { readFileSync, writeFileSync } from "node:fs";

const escribir = process.argv.includes("--escribir");
const ruta = "src/components/catalog-filters.tsx";
const antes = readFileSync(ruta, "utf8");

const viejo = 'text-xs font-bold uppercase tracking-wider text-ink-400';
const nuevo = 'text-xs font-bold uppercase tracking-wider text-ink-500';
const n = antes.split(viejo).length - 1;
const despues = antes.split(viejo).join(nuevo);

console.log(`${n} encabezados de filtro pasarían de ink-400 a ink-500`);
if (escribir && despues !== antes) {
  writeFileSync(ruta, despues, "utf8");
  console.log("escrito");
} else {
  console.log("usar --escribir para aplicar");
}
