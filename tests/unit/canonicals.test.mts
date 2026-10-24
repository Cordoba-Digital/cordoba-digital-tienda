/**
 * Cada página pública fija (no las de compra ni cuenta) declara su canonical:
 * sin él, Google elige solo entre las variantes de la URL (con barra final,
 * con parámetros) y puede quedarse con la que no es.
 *
 * Uso: npm test
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

test("las páginas públicas fijas tienen su canonical", () => {
  const sinCanonical: string[] = [];
  for (const dir of readdirSync("src/app", { withFileTypes: true })) {
    if (!dir.isDirectory() || /^[[(_]/.test(dir.name) || ["admin", "api"].includes(dir.name)) continue;
    const archivo = `src/app/${dir.name}/page.tsx`;
    if (!existsSync(archivo)) continue;
    const codigo = readFileSync(archivo, "utf8");
    if (!codigo.includes("export const metadata") || /index:\s*false/.test(codigo)) continue;
    if (!codigo.includes(`canonical: "/${dir.name}"`)) sinCanonical.push(dir.name);
  }
  assert.deepEqual(sinCanonical, []);
});
