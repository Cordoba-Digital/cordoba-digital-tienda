/**
 * Contraste que rompe la inversion: texto `text-ink-900/950` (que en oscuro pasa
 * a casi blanco) sobre un fondo que NO se invierte, porque ya es saturado
 * (naranja, ambar, verde, rojo) o sigue siendo blanco.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx|ts)$/.test(name)) files.push(p);
  }
})("src");

const SATURATED = /bg-(?:neon-\d|amber-\d|orange-\d|emerald-\d|green-\d|rose-\d|red-\d|white)/;
const DARK_TEXT = /text-ink-(?:900|950)/;

let total = 0;
for (const f of files) {
  const lines = readFileSync(f, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (!SATURATED.test(line) || !DARK_TEXT.test(line)) return;
    total += 1;
    console.log(`${(f + ":" + (i + 1)).padEnd(38)} ${line.trim().replace(/\s+/g, " ").slice(0, 115)}`);
  });
}
console.log(`\ntotal: ${total}`);
