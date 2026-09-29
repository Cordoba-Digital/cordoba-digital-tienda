/**
 * Verifica el CSS construido en vez de confiar en el build.
 *
 * Un `build` en verde no dice nada sobre si las utilidades se emitieron: si
 * `--color-surface` no llegara al tema, `bg-surface` saldria del CSS y las
 * tarjetas se verian sin fondo, sin ningun error de compilacion.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === "dev" || name === "cache") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith(".css")) files.push(p);
  }
})(".next/static");

if (files.length === 0) {
  console.error("No hay CSS construido en .next/static");
  process.exit(1);
}

const css = files.map((f) => readFileSync(f, "utf8")).join("\n");
console.log(`CSS: ${files.map((f) => f.split(/[\\/]/).pop()).join(", ")} (${(css.length / 1024).toFixed(0)} KB)\n`);

const CHECKS = [
  ["bloque html.dark", /html\.dark\s*\{/],
  ["html.dark gana a :root", /html\.dark\{[^}]*--color-ink-50/],
  ["surface en tema claro", /:root[^{]*\{[^}]*--color-surface:\s*#fff/],
  ["surface en oscuro", /html\.dark\{[^}]*--color-surface:\s*#101828/],
  ["deep declarado", /--color-deep:\s*#0a1226/],
  ["utilidad bg-surface", /\.bg-surface\b/],
  ["utilidad bg-deep", /\.bg-deep\b/],
  ["utilidad text-deep", /\.text-deep\b/],
  ["variante dark por clase", /\.dark\\:hidden|:is\(\.dark[^{]*\.dark:hidden/],
  ["mesh-dark repunta la rampa clara", /\.mesh-dark\{[^}]*--color-ink-200/],
  ["card-surface usa la variable", /\.card-surface\{[^}]*var\(--color-surface\)/],
  ["rampas de las secciones oscuras fijas", /\.mesh-dark\{[^}]*--color-ink-50:\s*#f5f7fb/],
];

let fail = 0;
for (const [label, re] of CHECKS) {
  const ok = re.test(css);
  if (!ok) fail += 1;
  console.log(`${ok ? "ok  " : "FALTA"} ${label}`);
}

// El fondo del body tiene que salir de la variable, no de un color fijo.
const bodyOk = /body\{[^}]*var\(--color-ink-50\)/.test(css) || /background:var\(--color-ink-50\)/.test(css);
console.log(`${bodyOk ? "ok  " : "FALTA"} body toma el fondo de la variable`);
if (!bodyOk) fail += 1;

console.log(`\n${fail === 0 ? "TODO OK" : `${fail} FALTAN`}`);
process.exit(fail === 0 ? 0 : 1);
