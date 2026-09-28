/**
 * Prueba objetiva de codificación: cuenta code points concretos en un archivo.
 * No depende de la consola ni de listas de textos escritas a mano.
 *
 * Uso: node scripts/check-accents.mjs [archivo ...]
 */
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const TARGETS = [
  "src/components/cart-view.tsx",
  "src/components/cart-drawer.tsx",
  "src/components/checkout-flow.tsx",
  "src/components/order-confirmation.tsx",
  "src/components/product-card.tsx",
  "src/components/site-header.tsx",
  "src/app/page.tsx",
  "src/app/producto/[slug]/page.tsx",
];

/** Acentos y símbolos que deben aparecer en español rioplatense. */
const WANTED = [
  ["o-con-tilde", "ó"],
  ["i-con-tilde", "í"],
  ["e-con-tilde", "é"],
  ["a-con-tilde", "á"],
  ["u-con-tilde", "ú"],
  ["n-con-tilde", "ñ"],
  ["interrogacion", "¿"],
  ["emoji-caja", "\u{1F4E6}"],
];

/** Secuencias que SOLO aparecen si el archivo está doblemente codificado. */
const POISON = [
  ["A-tilde (mojibake)", "Ã"],
  ["A-circunflejo (mojibake)", "Â"],
  ["reemplazo U+FFFD", "\uFFFD"],
];

const files = process.argv.slice(2).length ? process.argv.slice(2) : TARGETS;
let problems = 0;

for (const rel of files) {
  const text = readFileSync(resolve(process.cwd(), rel), "utf8");
  const bom = text.charCodeAt(0) === 0xfeff;
  const poison = POISON.map(([name, ch]) => [name, text.split(ch).length - 1]).filter(([, n]) => n > 0);
  const found = WANTED.map(([name, ch]) => [name, text.split(ch).length - 1]).filter(([, n]) => n > 0);

  const ok = poison.length === 0 && !bom;
  if (!ok) problems += 1;

  console.log(`\n${basename(rel)}  ${ok ? "OK" : "REVISAR"}`);
  if (bom) console.log("  ! BOM presente");
  for (const [name, n] of poison) console.log(`  ! ${name}: ${n} ocurrencias`);
  console.log(`  acentos/enie/encontrados: ${found.length}/${WANTED.length}`);
  console.log(
    "  " + (found.length ? found.map(([name, n]) => `${name}=${n}`).join("  ") : "ninguno (solo ASCII)"),
  );
}

console.log(`\n[check-accents] ${files.length - problems}/${files.length} archivos limpios.`);
process.exitCode = problems ? 1 : 0;
