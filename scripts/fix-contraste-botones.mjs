/**
 * Sube un paso los fondos que llevan etiqueta blanca.
 *
 * La propia paleta lo dice en globals.css: "Para links y botones con etiqueta
 * blanca va `brand-700` (#c2410c, 5,2:1)". `brand-600` (#e8590c) con blanco da
 * 3,58:1 y el AA de WCAG pide 4,5:1 para texto normal. Lo mismo pasaba con
 * `emerald-500`, que daba 2,47:1.
 *
 * Solo toca las líneas donde el fondo aparece junto a `text-white`, que son
 * exactamente los casos rotos, y desplaza un paso el `hover` de la misma clase
 * para que el hover siga siendo distinguible.
 *
 * Uso: node scripts/fix-contraste-botones.mjs <familia> [<familia> ...] [--escribir]
 *   ejemplo: node scripts/fix-contraste-botones.mjs brand emerald --escribir
 *
 * Para revisar el resultado en el navegador:
 *   node scripts/check-contraste.mjs <url>
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const escribir = args.includes("--escribir");
const familias = args.filter((a) => !a.startsWith("--"));
if (!familias.length) {
  console.error("faltan familias, por ejemplo: node scripts/fix-contraste-botones.mjs brand --escribir");
  process.exit(1);
}

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
let lineasTocadas = 0;

for (const familia of familias) {
  for (const ruta of archivos("src")) {
    const antes = readFileSync(ruta, "utf8");
    const despues = antes
      .split("\n")
      .map((linea) => {
        if (!linea.includes(`bg-${familia}-500`) || !linea.includes("text-white")) return linea;
        const nueva = linea
          .replace(new RegExp(`hover:bg-${familia}-500\\b`, "g"), `hover:bg-${familia}-600`)
          .replace(new RegExp(`\\bbg-${familia}-500\\b`, "g"), `bg-${familia}-700`)
          .replace(new RegExp(`hover:bg-${familia}-700\\b`, "g"), `hover:bg-${familia}-800`);
        if (nueva !== linea) {
          lineasTocadas += 1;
          cambios.push({ ruta, antes: linea.trim(), despues: nueva.trim() });
        }
        return nueva;
      })
      .join("\n");
    if (despues !== antes && escribir) writeFileSync(ruta, despues, "utf8");
  }
}

for (const c of cambios) {
  console.log(`${c.ruta}`);
  console.log(`  - ${c.antes}`);
  console.log(`  + ${c.despues}`);
}
console.log(
  `\n${lineasTocadas} lineas tocadas en ${familias.join(", ")}${escribir ? " (escrito)" : " (usar --escribir para aplicar)"}`,
);
