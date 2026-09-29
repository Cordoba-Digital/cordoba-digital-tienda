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

/**
 * Señales que NO dependen de poder decodificar la secuencia, y por eso
 * detectan lo que `repair` se deja:
 *
 * - U+0080..U+009F: controles C1. En un archivo de código nunca son válidos, y
 *   son justo lo que aparece cuando un UTF-8 se lee como latin1. Ejemplo real:
 *   el selector de variación U+FE0F (EF B8 8F) quedó como "ï" + "¸" + U+008F
 *   y el gate decía "OK".
 * - U+FFFD: el carácter de reemplazo, que aparece cuando algo se decodificó
 *   con bytes que no eran UTF-8.
 * - CJK y fullwidth: este repo es íntegramente en español. Que aparezca un
 *   ideograma o un signo fullwidth significa que se coló un fragmento de otro
 *   idioma (pasó tres veces hoy escribiendo comentarios).
 */
const SENALES = [
  ["control C1", /[\u0080-\u009f]/g],
  ["reemplazo U+FFFD", /\uFFFD/g],
  ["caracter CJK", /[\u3000-\u303f\u4e00-\u9fff\uac00-\ud7af]/g],
  ["signo fullwidth", /[\uff01-\uff5e\uffe0-\uffe6]/g],
];

/** Texto de la línea donde cae la señal, para poder reportarla. */
function reportar(abs, archivo, señal, re) {
  archivo
    .split(/\r?\n/)
    .forEach((linea, i) => {
      re.lastIndex = 0;
      if (!re.test(linea)) return;
      const marcas = [...new Set(linea.match(re))].map(
        (c) => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`,
      );
      console.log(`  ${relative(process.cwd(), abs)}:${i + 1}  [${señal}] ${marcas.join(" ")}`);
      console.log(`      ${linea.trim().slice(0, 100)}`);
    });
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

    for (const [señal, re] of SENALES) {
      re.lastIndex = 0;
      if (!re.test(raw)) continue;
      bad += 1;
      reportar(abs, raw, señal, re);
    }
  }

  console.log(
    bad === 0
      ? `[check-encoding] ${files.length} archivos, ninguno corrupto.`
      : `[check-encoding] ${bad} problema(s) en ${files.length} archivos.`,
  );
  process.exitCode = bad ? 1 : 0;
}

main();
