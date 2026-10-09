/** Inventario de colores literales para preparar el modo oscuro. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "src";
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx|ts|css)$/.test(name)) files.push(p);
  }
})(ROOT);

const PATTERNS = [
  ["bg-white (opaco)", /\bbg-white\b(?![\w/-])/g],
  ["bg-white/ (alfa)", /\bbg-white\//g],
  ["bg-ink-900/950", /\bbg-ink-(?:900|950)\b/g],
  ["text-white", /\btext-white\b/g],
  ["border-ink-100/200", /\bborder-ink-(?:100|200)\b/g],
];

for (const [label, re] of PATTERNS) {
  const hits = [];
  for (const f of files) {
    const lines = readFileSync(f, "utf8").split("\n");
    lines.forEach((line, i) => {
      re.lastIndex = 0;
      if (re.test(line)) hits.push(`${f}:${i + 1}`);
    });
  }
  console.log(`\n=== ${label} (${hits.length}) ===`);
  console.log(hits.join("\n"));
}
