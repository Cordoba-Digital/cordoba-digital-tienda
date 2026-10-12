/**
 * Pruebas de las opciones de envío. Los importes del pedido son pesos enteros
 * en la base: una tarifa con centavos rompía el checkout con un 500.
 *
 * Uso: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { findShippingOption, normalizeZip, shippingOptions } from "../../src/lib/shipping";

test("normaliza el código postal a 4 dígitos", () => {
  assert.equal(normalizeZip("X5000ABC"), "5000");
  assert.equal(normalizeZip(" 5 0 0 0 "), "5000");
  assert.equal(normalizeZip(""), "");
});

test("sin código postal válido solo queda el retiro gratis", () => {
  const opciones = shippingOptions("12");
  assert.deepEqual(opciones.map((o) => o.id), ["pickup"]);
  assert.equal(opciones[0].cost, 0);
});

test("con código postal ofrece Andreani a domicilio y a sucursal", () => {
  assert.deepEqual(shippingOptions("5000").map((o) => o.id), ["pickup", "standard", "express"]);
});

test("todas las tarifas son pesos enteros y positivos", () => {
  for (const zip of ["1000", "3300", "5000", "6000", "8000", "8400", "9410"]) {
    for (const opcion of shippingOptions(zip).filter((o) => o.id !== "pickup")) {
      assert.ok(Number.isInteger(opcion.cost) && opcion.cost > 0, `${zip} ${opcion.id}: ${opcion.cost}`);
    }
  }
});

test("sucursal sale más barato que domicilio", () => {
  const domicilio = findShippingOption("5000", "standard");
  const sucursal = findShippingOption("5000", "express");
  assert.ok(domicilio && sucursal && sucursal.cost < domicilio.cost);
});
