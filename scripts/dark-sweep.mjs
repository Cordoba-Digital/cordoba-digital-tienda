/**
 * Modo oscuro, parte 1: barrido mecanico.
 *
 * Tailwind v4 compila `bg-ink-50` a `var(--color-ink-50)`, asi que alcanza con
 * redefinir las variables dentro de `html.dark` para que la escala de grises se
 * invierta sola. Lo que NO se invierte son los colores literales:
 *
 *  - `bg-white` (52 usos) pasa a `bg-surface`, que en oscuro es el panel oscuro.
 *    Se exceptuan las dos placas del logo, que son blancas en los dos temas
 *    porque la imagen del logo ya trae fondo blanco.
 *  - `bg-ink-900/950` pasa a `bg-deep`: botones "Ver mas", contadores y
 *    distintivos sobre foto, que tienen que quedar oscuros en ambos temas.
 *  - Tres `bg-white/xx` que estan sobre superficies claras pasan a
 *    `bg-surface/xx`; los que viven dentro de `mesh-dark` no se tocan.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx|ts)$/.test(name)) files.push(p);
  }
})("src");

/** Placas del logo: blancas siempre. */
const LOGO_PLATES = new Set(["src\\components\\site-footer.tsx:24", "src\\components\\site-header.tsx:131"]);

/** `bg-white/xx` sobre superficie clara (no dentro de mesh-dark). */
const GLASS_ON_SURFACE = new Set([
  "src\\components\\site-header.tsx:113",
  "src\\components\\product-detail.tsx:250",
  "src\\components\\product-card.tsx:80",
]);

let changedFiles = 0;
let countWhite = 0;
let countDeep = 0;
let countGlass = 0;

for (const file of files) {
  const original = readFileSync(file, "utf8");
  const lines = original.split("\n");

  const next = lines.map((line, i) => {
    const key = `${file}:${i + 1}`;
    let out = line;

    if (GLASS_ON_SURFACE.has(key)) {
      const hits = out.match(/bg-white\//g);
      if (hits) {
        countGlass += hits.length;
        out = out.replace(/bg-white\//g, "bg-surface/");
      }
    }

    if (!LOGO_PLATES.has(key)) {
      const hits = out.match(/(^|[^\w/-])bg-white(?![\w/-])/g);
      if (hits) {
        countWhite += hits.length;
        out = out.replace(/(^|[^\w/-])bg-white(?![\w/-])/g, "$1bg-surface");
      }
    }

    const deep = out.match(/bg-ink-(?:900|950)(?![0-9])/g);
    if (deep) {
      countDeep += deep.length;
      out = out.replace(/bg-ink-(?:900|950)(?![0-9])/g, "bg-deep");
    }

    return out;
  });

  const updated = next.join("\n");
  if (updated !== original) {
    writeFileSync(file, updated, "utf8");
    changedFiles += 1;
  }
}

console.log(`archivos tocados: ${changedFiles}`);
console.log(`bg-white -> bg-surface: ${countWhite}`);
console.log(`bg-ink-900/950 -> bg-deep: ${countDeep}`);
console.log(`bg-white/xx -> bg-surface/xx: ${countGlass}`);
