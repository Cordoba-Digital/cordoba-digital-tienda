/**
 * Pruebas de los datos del comprador y de la entrega. La UI y la API usan las
 * mismas funciones, así que un error acá deja pasar pedidos sin datos.
 *
 * Uso: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { validateDelivery, validatePersonalData } from "../../src/lib/checkout-validation";

const persona = { firstName: "Ana", lastName: "Pérez", email: "ana@example.com", phone: "351 555-1234", docId: "30.123.456" };
const domicilio = { method: "standard" as const, zip: "5000", street: "27 de Abril", number: "180", city: "Córdoba", province: "Córdoba" };

test("datos completos pasan", () => {
  assert.deepEqual(validatePersonalData(persona), {});
  assert.deepEqual(validateDelivery(domicilio), {});
});

test("marca cada dato personal que falta", () => {
  const errores = validatePersonalData({ firstName: "", lastName: "P", email: "ana@", phone: "123", docId: "12" });
  assert.deepEqual(Object.keys(errores).sort(), ["docId", "email", "firstName", "lastName", "phone"]);
});

test("retiro en el local no pide domicilio", () => {
  assert.deepEqual(validateDelivery({ method: "pickup", zip: "" }), {});
});

test("envío pide código postal de 4 dígitos y dirección", () => {
  const errores = validateDelivery({ method: "standard", zip: "50", street: "", number: "", city: "", province: "" });
  assert.deepEqual(Object.keys(errores).sort(), ["city", "number", "province", "street", "zip"]);
});

test("acepta el código postal con letras (X5000)", () => {
  assert.deepEqual(validateDelivery({ ...domicilio, zip: "X5000ABC" }), {});
});

test("exige forma de envío cuando se pide", () => {
  assert.ok(validateDelivery({ ...domicilio, requireShippingOption: true, selectedOption: null }).delivery);
});
