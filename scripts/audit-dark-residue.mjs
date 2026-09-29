/** Resaca de la inversion: clases cuya apariencia depende del tema. */
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

const CHECKS = [
  // En oscuro `ink-900` es casi blanco: una sombra clara se ve como un halo.
  ["sombra con ink-900", /shadow-ink-(?:800|900|950)/g],
  // Tintes claros que no se invierten: quedan como cajas luminosas en modo oscuro.
  ["fondo -50 saturado", /bg-(?:emerald|rose|amber|orange|red|green|sky|blue|brand)-50(?![\w-])/g],
  ["fondo -100 saturado", /bg-(?:emerald|rose|amber|orange|red|green|sky|blue|brand)-100(?![\w-])/g],
];

for (const [label, re] of CHECKS) {
  const hits = [];
  for (const f of files) {
    readFileSync(f, "utf8")
      .split("\n")
      .forEach((line, i) => {
        re.lastIndex = 0;
        const m = line.match(re);
        if (m) hits.push(`${f}:${i + 1}  x${m.length}  ${line.trim().replace(/\s+/g, " ").slice(0, 80)}`);
      });
  }
  console.log(`\n=== ${label} (${hits.length} lineas) ===`);
  console.log(hits.join("\n"));
}
