/**
 * Registro de errores del servidor: qué se tacha antes de guardar y cómo se
 * agrupan los errores iguales.
 *
 * Uso: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";

// `error-log` importa la base; alcanza con una URL que nunca se usa.
process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:1/test";
const { fingerprint, redact } = await import("../../src/lib/error-log");

test("tacha emails y números largos, pero deja los cortos", () => {
  assert.equal(redact("No existe ana.perez@example.com"), "No existe [email]");
  assert.equal(redact("DNI 30.123.456 y tel 351 555-1234"), "DNI [número] y tel [número]");
  assert.equal(redact("Tarjeta 4509 9535 6623 3704"), "Tarjeta [número]");
  assert.equal(redact("Stock 12 en la línea 340"), "Stock 12 en la línea 340");
});

test("el mismo error con otro id, pedido o número da la misma huella", () => {
  const ruta = "/api/admin/orders/[code]";
  assert.equal(
    fingerprint("Pedido 123 no encontrado", ruta),
    fingerprint("Pedido 98765 no encontrado", ruta),
  );
  assert.equal(
    fingerprint("Sesión 0b7c9e3a-1f2d-4c5b-8a9e-112233445566 vencida", ruta),
    fingerprint("Sesión 5d4c3b2a-0000-4111-9222-aabbccddeeff vencida", ruta),
  );
  assert.equal(fingerprint("hash deadbeefcafe1234 inválido", ruta), fingerprint("hash 0123456789abcdef inválido", ruta));
});

test("otro mensaje u otra ruta dan otra huella, siempre de 24 caracteres hex", () => {
  const a = fingerprint("Pedido no encontrado", "/pedido/[code]");
  assert.match(a, /^[0-9a-f]{24}$/);
  assert.notEqual(a, fingerprint("Pedido no encontrado", "/api/checkout"));
  assert.notEqual(a, fingerprint("Producto no encontrado", "/pedido/[code]"));
});
