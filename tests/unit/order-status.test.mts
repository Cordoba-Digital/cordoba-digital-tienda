/**
 * Pruebas de las transiciones de estado de un pedido.
 *
 * Uso: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";

// `order-status` importa la base; alcanza con una URL que nunca se usa.
process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:1/test";
const { canTransition } = await import("../../src/lib/order-status");

test("el flujo avanza", () => {
  assert.equal(canTransition("pendiente_pago", "pago_confirmado"), null);
  assert.equal(canTransition("pago_confirmado", "enviado"), null);
});

test("no vuelve atrás", () => {
  assert.ok(canTransition("enviado", "pendiente_pago"));
});

test("se puede cancelar mientras el pedido no salió", () => {
  assert.equal(canTransition("pago_confirmado", "cancelado"), null);
  assert.ok(canTransition("enviado", "cancelado"));
  assert.ok(canTransition("entregado", "cancelado"));
});

test("un cancelado se puede reactivar", () => {
  assert.equal(canTransition("cancelado", "pago_confirmado"), null);
});
