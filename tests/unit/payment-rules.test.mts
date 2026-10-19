/**
 * Reglas de cobro por medio de pago: lo que se paga online y al retirar, qué
 * cuenta como pagado, y que los textos para el cliente lean los plazos de las
 * constantes en vez de tenerlos escritos a mano.
 *
 * Uso: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { orderBanner } from "../../src/lib/order-banner";
import {
  amountDueAtPickup,
  amountDueOnline,
  isPaidStatus,
  pendingExpiryHours,
  PENDING_EXPIRY_HOURS,
  SENA_EXPIRY_HOURS,
  SENA_PESOS,
  STOCK_HOLD_HOURS,
  wasEverPaid,
} from "../../src/lib/payment-rules";
import { ORDER_STATUS_FLOW, PAYMENT_METHODS } from "../../src/lib/pricing";

test("con seña se cobra la seña online y el resto al retirar", () => {
  const order = { paymentMethod: "sena", total: 150_000 };
  assert.equal(amountDueOnline(order), SENA_PESOS);
  assert.equal(amountDueAtPickup(order), 150_000 - SENA_PESOS);
  assert.equal(amountDueOnline(order) + amountDueAtPickup(order), order.total);
});

test("con seña y un pedido menor a la seña se paga el total y no queda resto", () => {
  const order = { paymentMethod: "sena", total: 6_000 };
  assert.equal(amountDueOnline(order), 6_000);
  assert.equal(amountDueAtPickup(order), 0);
});

test("los otros medios cobran el total online y no dejan resto", () => {
  for (const paymentMethod of ["transferencia", "usdt", "mercadopago", "efectivo"]) {
    assert.equal(amountDueOnline({ paymentMethod, total: 80_000 }), 80_000);
    assert.equal(amountDueAtPickup({ paymentMethod, total: 80_000 }), 0);
  }
});

test("la seña vence antes que el resto de las órdenes sin pago", () => {
  assert.equal(pendingExpiryHours("sena"), SENA_EXPIRY_HOURS);
  assert.equal(pendingExpiryHours("transferencia"), PENDING_EXPIRY_HOURS);
  assert.ok(SENA_EXPIRY_HOURS < PENDING_EXPIRY_HOURS);
});

test("cuentan como pagados solo los estados con la plata acreditada", () => {
  for (const status of ["pago_confirmado", "preparando", "enviado", "entregado"]) assert.ok(isPaidStatus(status), status);
  for (const status of ["pendiente_pago", "cancelado", "otro"]) assert.ok(!isPaidStatus(status), status);
});

test("un pedido cancelado después de pagarse sigue contando como cobrado", () => {
  assert.ok(wasEverPaid("cancelado", ["pendiente_pago", "pago_confirmado", "cancelado"]));
  assert.ok(!wasEverPaid("cancelado", ["pendiente_pago", "cancelado"]));
  assert.ok(wasEverPaid("enviado", []));
});

test("los textos para el cliente usan los plazos y el monto de las constantes", () => {
  const pending = { customerName: "Ana", status: "pendiente_pago", total: 50_000 };
  assert.match(orderBanner({ ...pending, paymentMethod: "transferencia" }).detail ?? "", new RegExp(`stock ${STOCK_HOLD_HOURS} hs`));
  assert.match(orderBanner({ ...pending, paymentMethod: "sena" }).detail ?? "", new RegExp(`en ${SENA_EXPIRY_HOURS} hs`));
  assert.match(ORDER_STATUS_FLOW[0].description, new RegExp(`${STOCK_HOLD_HOURS} hs`));
  const sena = PAYMENT_METHODS.find((m) => m.id === "sena");
  assert.equal(sena?.label, "Seña de $10.000 y resto en el local");
});
