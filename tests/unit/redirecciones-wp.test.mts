/**
 * Redirecciones de las direcciones viejas del WordPress: cada página vieja
 * tiene que llevar a una página que exista, sin tapar ninguna de la tienda, y
 * las páginas 2, 3… de los listados no pueden caer en la regla general de
 * categorías.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";

const { default: config, PAGINAS_WP } = await import("../../next.config");

function paginaExiste(ruta: string): boolean {
  const limpia = ruta.split(/[?#]/)[0].replace(/^\/+|\/+$/g, "");
  return existsSync(limpia ? `src/app/${limpia}/page.tsx` : "src/app/page.tsx");
}

test("cada página vieja lleva a una página que existe y no tapa ninguna de la tienda", () => {
  for (const [source, destination] of PAGINAS_WP) {
    assert.ok(paginaExiste(destination), `${source} -> ${destination}: el destino no existe`);
    assert.ok(!paginaExiste(source), `${source} ya es una página de la tienda: la redirección la taparía`);
  }
});

test("las páginas de los listados van antes que la regla general de categorías", async () => {
  const lista = await config.redirects!();
  const indice = (source: string) => lista.findIndex((r) => r.source === source);
  const paginada = indice("/categoria-producto/:ruta*/page/:n(\\d+)");
  const general = indice("/categoria-producto/:ruta*");
  assert.ok(paginada >= 0 && general >= 0);
  assert.ok(paginada < general);
  assert.ok(lista.every((r) => r.permanent === true));
});
