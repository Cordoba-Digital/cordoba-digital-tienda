/**
 * Verifica que ningún archivo del proyecto tenga doble codificación UTF-8.
 *
 * Usa la MISMA función que la reparación (`repair`), así que detecta también
 * los casos que un grep simple no ve: los emojis de 4 bytes dejan "ðŸ”¥" y no
 * contienen ni "Ã" ni "Â", así que un chequeo por caracteres se los pierde
 * (pasó: el 🔥 de la barra del header quedó roto y el chequeo decía "OK").
 *
 * Recorre todo `src/` recursivamente, sin lista manual.
 *
 * Uso: node scripts/check-accents.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

import { repair } from "./fix-encoding.mjs";

const ROOTS = ["src"];
const EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".css"]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walk(full, out);
    } else if (EXTS.has(extname(full))) {
      out.push(full);
    }
  }
  return out;
}

function main() {
  const files = process.argv.slice(2).length
    ? process.argv.slice(2)
    : ROOTS.flatMap((r) => walk(resolve(process.cwd(), r)));

  let bad = 0;
  for (const abs of files) {
    const raw = readFileSync(abs, "utf8");
    const { fixed } = repair(raw.replace(/^\uFEFF/, ""));
    if (fixed > 0) {
      bad += 1;
      console.log(`  ${relative(process.cwd(), abs)}: ${fixed} secuencias corruptas`);
    }
  }

  console.log(
    bad === 0
      ? `[check-encoding] ${files.length} archivos, ninguno corrupto.`
      : `[check-encoding] ${bad}/${files.length} archivos con doble codificación.`,
  );
  process.exitCode = bad ? 1 : 0;
}

main();
