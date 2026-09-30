/**
 * Corre el control de contraste sobre todas las rutas públicas y falla si
 * alguna tiene texto por debajo del mínimo de WCAG AA.
 *
 * El control mide en un navegador real porque Tailwind v4 emite los colores en
 * oklch() y lab(), y cualquier cálculo hecho sobre el texto del CSS se
 * equivoca. Ver scripts/check-contraste.mjs para la medición.
 *
 * Los textos que van sobre una foto o un degradado no se pueden medir: se
 * listan aparte como "no verificables" y no cuentan como falla, porque ahí hay
 * que mirar la página a ojo.
 *
 * Uso: node scripts/contraste-todas.mjs [baseUrl]
 */
import { spawn } from "node:child_process";

const base = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");

const RUTAS = [
  "/",
  "/productos",
  "/producto/iphone-16-128gb-teal",
  "/ayuda",
  "/carrito",
  "/checkout",
  "/favoritos",
  "/seguimiento",
  "/guias",
  "/categoria/celulares-smartphones",
];

/** Rutas que tienen que responder 200 antes de mirarlas. */
async function viva(ruta) {
  try {
    const r = await fetch(base + ruta, { redirect: "manual" });
    return r.status === 200;
  } catch {
    return false;
  }
}

let totalFallas = 0;
let totalNoVerificables = 0;

console.log(`contraste en todas las rutas de ${base}\n`);
for (const ruta of RUTAS) {
  if (!(await viva(ruta))) {
    console.log(`  ?  ${ruta}  no respondió 200, se saltea`);
    continue;
  }
  // Cada medición abre su propio Chrome headless, así que se corre en un
  // proceso aparte: si no, se irían acumulando navegadores.
  const salida = await new Promise((resolve) => {
    const p = spawn(process.execPath, ["scripts/check-contraste.mjs", base + ruta], { encoding: "utf8" });
    let acc = "";
    p.stdout.on("data", (d) => (acc += d));
    p.stderr.on("data", (d) => (acc += d));
    p.on("close", () => resolve(acc));
  });

  const n = Number((salida.match(/(\d+) combinaciones/) || [])[1] ?? 0);
  const nv = Number((salida.match(/no verificables[^:]*: (\d+)/) || [])[1] ?? 0);
  totalFallas += n;
  totalNoVerificables += nv;

  const marca = n === 0 ? "ok  " : "FALLA";
  console.log(`  ${marca} ${ruta.padEnd(34)} ${n} fallas · ${nv} no verificables`);
  for (const m of salida.matchAll(/^\s+([\d.]+):1\s+\(pide [\d.]+\).*$/gm)) {
    console.log(`        ${m[0].trim()}`);
  }
  for (const m of salida.matchAll(/^\s+"(.+?)" — (degradado|imagen).*$/gm)) {
    console.log(`        sin medir: "${m[1]}" (${m[2]})`);
  }
}

console.log(
  `\n[contraste] ${totalFallas} combinaciones por debajo de AA · ${totalNoVerificables} sin medir sobre imagen`,
);
process.exitCode = totalFallas > 0 ? 1 : 0;
