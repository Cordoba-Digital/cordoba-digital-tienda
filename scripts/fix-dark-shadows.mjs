/**
 * Las sombras de los paneles flotantes usaban `shadow-ink-900`, que en el tema
 * oscuro pasa a ser casi blanco y se ve como un halo. `shadow-black` es negro
 * en los dos temas, que es lo que tiene que ser una sombra.
 */
import { readFileSync, writeFileSync } from "node:fs";

const file = "src/components/site-header.tsx";
const original = readFileSync(file, "utf8");
const updated = original.replace(/shadow-ink-900\/(\d+)/g, "shadow-black/$1");

if (updated === original) {
  console.log("sin cambios");
  process.exit(0);
}

writeFileSync(file, updated, "utf8");
console.log(`reemplazos: ${(original.match(/shadow-ink-900\//g) || []).length}`);
