/**
 * Búsqueda que entiende categoría y marca ("celular samsung" → Celulares +
 * Samsung), como el `domain_discovery` de Mercado Libre.
 *
 * Uso: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeSearch, understandQuery, type QueryCategory } from "../../src/lib/query-understanding";

const cat = (id: number, name: string, path: string, parentId: number | null = null, count = 10): QueryCategory => ({
  id,
  name,
  path,
  depth: path.split("/").length - 1,
  parentId,
  count,
});

const catalogo = {
  categories: [
    cat(1, "Celulares", "celulares"),
    cat(2, "Samsung", "celulares/samsung", 1),
    cat(3, "Accesorios P/ Celulares", "accesorios-p-celulares"),
    cat(4, "Notebooks Córdoba", "computacion/notebooks-cordoba"),
    cat(5, "Televisores", "televisores"),
    cat(6, "Samsung", "televisores/samsung", 5),
    cat(7, "Cámaras", "camaras"),
  ],
  brands: ["Samsung", "Apple", "TP-Link", "TP", "Lenovo"],
};

test("normaliza tildes, mayúsculas y signos", () => {
  assert.equal(normalizeSearch("  Cámaras P/ Autos!! "), "camaras p autos");
});

test("celular samsung: la subcategoría Samsung de Celulares, sin palabras de más", () => {
  assert.deepEqual(understandQuery("celular samsung", catalogo), {
    category: { id: 2, name: "Samsung", path: "celulares/samsung" },
    brand: "Samsung",
    terms: [],
  });
});

test("lo que no es categoría ni marca queda para buscar", () => {
  const r = understandQuery("Celulares Samsung A55 128gb", catalogo);
  assert.equal(r.category?.id, 2);
  assert.deepEqual(r.terms, ["a55", "128gb"]);
});

test("singular, tildes y la ciudad del nombre no importan", () => {
  assert.equal(understandQuery("notebook lenovo", catalogo).category?.id, 4);
  assert.equal(understandQuery("notebook lenovo", catalogo).brand, "Lenovo");
  assert.equal(understandQuery("camara", catalogo).category?.id, 7);
});

test("la categoría con más palabras gana: accesorios para celular", () => {
  const r = understandQuery("accesorios para celular", catalogo);
  assert.equal(r.category?.id, 3);
  assert.deepEqual(r.terms, []);
});

test("una marca sola no elige categoría si está en varias", () => {
  const r = understandQuery("samsung", catalogo);
  assert.equal(r.category, null);
  assert.equal(r.brand, "Samsung");
});

test("la marca de varias palabras gana a la corta", () => {
  assert.equal(understandQuery("router tp link", catalogo).brand, "TP-Link");
  assert.deepEqual(understandQuery("router tp link", catalogo).terms, ["router"]);
});

test("con un error de tipeo no inventa nada y busca las palabras", () => {
  assert.deepEqual(understandQuery("celuar samsng", catalogo), { category: null, brand: null, terms: ["celuar", "samsng"] });
});
