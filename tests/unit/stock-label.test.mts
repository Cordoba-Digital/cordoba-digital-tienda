import assert from "node:assert/strict";
import { test } from "node:test";

import { offerStockCount, unitsLabel } from "../../src/lib/stock-label";

test("muestra la cantidad solo en ofertas con stock cargado de verdad", () => {
  assert.equal(offerStockCount({ stock: 7, price: 900, compareAtPrice: 1000 }), 7);
  // 1 es el "hay" del catálogo migrado, no una cantidad.
  assert.equal(offerStockCount({ stock: 1, price: 900, compareAtPrice: 1000 }), null);
  assert.equal(offerStockCount({ stock: 0, price: 900, compareAtPrice: 1000 }), null);
  // Sin oferta (o con un "antes" que no es más caro) no se muestra.
  assert.equal(offerStockCount({ stock: 7, price: 900, compareAtPrice: null }), null);
  assert.equal(offerStockCount({ stock: 7, price: 900, compareAtPrice: 900 }), null);
});

test("el texto concuerda en número", () => {
  assert.equal(unitsLabel(1), "1 unidad disponible");
  assert.equal(unitsLabel(12), "12 unidades disponibles");
  assert.equal(unitsLabel(1500), "1.500 unidades disponibles");
});
