/**
 * Etiquetas del WordPress viejo (`/etiqueta-producto/<tag>`): a la ficha si
 * son de un solo producto, y si no, a una búsqueda que pueda encontrar algo.
 *
 * Uso: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { destinoDeEtiqueta, formasDeEtiqueta, palabrasDeEtiqueta } from "../../src/lib/tag-redirect";

const { default: config } = await import("../../next.config");

test("las palabras de la etiqueta salen sin guiones ni 'cordoba'", () => {
  assert.equal(palabrasDeEtiqueta("nikon-d750-body-cordoba"), "nikon d750 body");
  assert.equal(palabrasDeEtiqueta("lente-normal-canon-corodoba"), "lente normal canon");
  assert.equal(palabrasDeEtiqueta("Córdoba"), "");
  assert.equal(palabrasDeEtiqueta("gopro"), "gopro");
});

test("una etiqueta de un solo producto lleva a su ficha", () => {
  assert.equal(destinoDeEtiqueta("nikon-d750-body-cordoba", ["nikon-d750"]), "/producto/nikon-d750");
});

test("una etiqueta de varios productos, o de ninguno, lleva a la búsqueda", () => {
  assert.equal(destinoDeEtiqueta("nikon", ["nikon-d750", "nikon-d7500-body"]), "/productos?q=nikon");
  assert.equal(destinoDeEtiqueta("lente-luminoso-canon-cordoba", []), "/productos?q=lente%20luminoso%20canon");
  assert.equal(destinoDeEtiqueta("cordoba", []), "/productos");
});

test("se busca la etiqueta tal cual y decodificada", () => {
  assert.deepEqual(formasDeEtiqueta("tv-50%e2%80%b3"), ["tv-50%e2%80%b3", "tv-50″"]);
  assert.deepEqual(formasDeEtiqueta("gopro"), ["gopro"]);
  // Un % suelto no rompe nada.
  assert.deepEqual(formasDeEtiqueta("100%"), ["100%"]);
});

test("next.config ya no redirige las etiquetas: las resuelve su propia ruta", async () => {
  const lista = await config.redirects!();
  assert.ok(!lista.some((r) => r.source.startsWith("/etiqueta-producto")));
});
