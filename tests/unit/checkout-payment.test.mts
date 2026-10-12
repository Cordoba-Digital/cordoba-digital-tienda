/**
 * Pruebas del medio de pago del checkout.
 *
 * La API no puede aceptar un medio que la tienda no ofrece: si aceptara
 * Mercado Pago oculto, alguien podría armar un pedido llamando a la API a mano
 * sin pasar nunca por el cobro.
 *
 * Uso: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { CHECKOUT_PAYMENT_METHODS, resolvePaymentMethod } from "../../src/lib/checkout-payment";

test("sin medio de pago usa transferencia", () => {
  assert.deepEqual(resolvePaymentMethod(undefined, "standard"), { ok: true, method: "transferencia" });
});

test("acepta transferencia con envío", () => {
  assert.deepEqual(resolvePaymentMethod("transferencia", "standard"), { ok: true, method: "transferencia" });
});

test("acepta efectivo retirando en el local", () => {
  assert.deepEqual(resolvePaymentMethod("efectivo", "pickup"), { ok: true, method: "efectivo" });
});

test("rechaza efectivo con envío", () => {
  assert.equal(resolvePaymentMethod("efectivo", "standard").ok, false);
});

test("rechaza Mercado Pago si el servidor no tiene sus credenciales", () => {
  assert.ok(!CHECKOUT_PAYMENT_METHODS.includes("mercadopago"), "Mercado Pago no va en la lista fija");
  assert.equal(resolvePaymentMethod("mercadopago", "standard").ok, false);
  assert.equal(resolvePaymentMethod("mercadopago", "pickup", { mercadoPago: false }).ok, false);
});

test("acepta Mercado Pago con credenciales, con envío o retirando", () => {
  assert.deepEqual(resolvePaymentMethod("mercadopago", "standard", { mercadoPago: true }), { ok: true, method: "mercadopago" });
  assert.deepEqual(resolvePaymentMethod("mercadopago", "pickup", { mercadoPago: true }), { ok: true, method: "mercadopago" });
});

test("con Mercado Pago activo sigue rechazando USDT y efectivo con envío", () => {
  assert.equal(resolvePaymentMethod("usdt", "standard", { mercadoPago: true }).ok, false);
  assert.equal(resolvePaymentMethod("efectivo", "standard", { mercadoPago: true }).ok, false);
});

test("rechaza USDT mientras está oculto", () => {
  assert.equal(resolvePaymentMethod("usdt", "standard").ok, false);
});

test("rechaza un medio inventado en vez de cambiarlo en silencio", () => {
  assert.equal(resolvePaymentMethod("gratis", "standard").ok, false);
  assert.equal(resolvePaymentMethod({ method: "mercadopago" }, "standard").ok, false);
});
