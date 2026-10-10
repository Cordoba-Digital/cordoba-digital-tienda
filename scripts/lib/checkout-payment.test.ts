/**
 * Pruebas del medio de pago del checkout.
 *
 * La API no puede aceptar un medio que la tienda no ofrece: si aceptara
 * Mercado Pago oculto, alguien podría armar un pedido llamando a la API a mano
 * sin pasar nunca por el cobro.
 *
 * Uso: npm run test:checkout
 */
import assert from "node:assert/strict";

import { CHECKOUT_PAYMENT_METHODS, resolvePaymentMethod } from "../../src/lib/checkout-payment";

let ok = 0;
let fallas = 0;

function prueba(nombre: string, fn: () => void) {
  try {
    fn();
    ok += 1;
    console.log(`  OK    ${nombre}`);
  } catch (error) {
    fallas += 1;
    console.log(`  FALLA ${nombre}\n        ${(error as Error).message.split("\n")[0]}`);
  }
}

console.log("checkout-payment: solo se aceptan los medios que se ofrecen\n");

prueba("sin medio de pago usa transferencia", () => {
  assert.deepEqual(resolvePaymentMethod(undefined, "standard"), { ok: true, method: "transferencia" });
});

prueba("acepta transferencia con envío", () => {
  assert.deepEqual(resolvePaymentMethod("transferencia", "standard"), { ok: true, method: "transferencia" });
});

prueba("acepta efectivo retirando en el local", () => {
  assert.deepEqual(resolvePaymentMethod("efectivo", "pickup"), { ok: true, method: "efectivo" });
});

prueba("rechaza efectivo con envío", () => {
  assert.equal(resolvePaymentMethod("efectivo", "standard").ok, false);
});

prueba("rechaza Mercado Pago si el servidor no tiene sus credenciales", () => {
  assert.ok(!CHECKOUT_PAYMENT_METHODS.includes("mercadopago"), "Mercado Pago no va en la lista fija");
  assert.equal(resolvePaymentMethod("mercadopago", "standard").ok, false);
  assert.equal(resolvePaymentMethod("mercadopago", "pickup", { mercadoPago: false }).ok, false);
});

prueba("acepta Mercado Pago con credenciales, con envío o retirando", () => {
  assert.deepEqual(resolvePaymentMethod("mercadopago", "standard", { mercadoPago: true }), { ok: true, method: "mercadopago" });
  assert.deepEqual(resolvePaymentMethod("mercadopago", "pickup", { mercadoPago: true }), { ok: true, method: "mercadopago" });
});

prueba("con Mercado Pago activo sigue rechazando USDT y efectivo con envío", () => {
  assert.equal(resolvePaymentMethod("usdt", "standard", { mercadoPago: true }).ok, false);
  assert.equal(resolvePaymentMethod("efectivo", "standard", { mercadoPago: true }).ok, false);
});

prueba("rechaza USDT mientras está oculto", () => {
  assert.equal(resolvePaymentMethod("usdt", "standard").ok, false);
});

prueba("rechaza un medio inventado en vez de cambiarlo en silencio", () => {
  assert.equal(resolvePaymentMethod("gratis", "standard").ok, false);
  assert.equal(resolvePaymentMethod({ method: "mercadopago" }, "standard").ok, false);
});

console.log(`\n[checkout-payment] ${ok}/${ok + fallas} OK`);
process.exit(fallas ? 1 : 0);
