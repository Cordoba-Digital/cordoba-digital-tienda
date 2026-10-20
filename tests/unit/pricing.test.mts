/**
 * Pruebas del cálculo del total. Es la cuenta que decide cuánto se cobra:
 * el servidor la repite en cada pedido con los precios de la base.
 *
 * Uso: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { computeTotals, couponDiscountFor, MAX_QTY_PER_ITEM, maxQuantityFor, type CouponInfo } from "../../src/lib/pricing";

const porcentaje = (value: number, minSubtotal = 0): CouponInfo => ({ code: "P", kind: "percent", value, minSubtotal, description: "" });
const fijo = (value: number, minSubtotal = 0): CouponInfo => ({ code: "F", kind: "fixed", value, minSubtotal, description: "" });

test("sin cupón no hay descuento", () => {
  assert.equal(couponDiscountFor(100_000, null), 0);
});

test("cupón de porcentaje redondea a pesos enteros", () => {
  assert.equal(couponDiscountFor(99_999, porcentaje(10)), 10_000);
  assert.ok(Number.isInteger(couponDiscountFor(12_345, porcentaje(7))));
});

test("cupón fijo nunca descuenta más que el subtotal", () => {
  assert.equal(couponDiscountFor(5_000, fijo(8_000)), 5_000);
  assert.equal(couponDiscountFor(50_000, fijo(8_000)), 8_000);
});

test("cupón con compra mínima no aplica por debajo", () => {
  assert.equal(couponDiscountFor(29_999, porcentaje(10, 30_000)), 0);
  assert.equal(couponDiscountFor(30_000, porcentaje(10, 30_000)), 3_000);
});

test("total = subtotal - cupón + envío", () => {
  const t = computeTotals({ subtotal: 200_000, coupon: fijo(20_000), shippingCost: 8_331, paymentMethod: "transferencia", installments: 1 });
  assert.equal(t.couponDiscount, 20_000);
  assert.equal(t.total, 188_331);
  assert.equal(t.paymentAdjustment, 0);
});

test("ningún medio de pago ni cantidad de cuotas cambia el total", () => {
  const base = { subtotal: 150_000, coupon: null, shippingCost: 0 } as const;
  const totales = (["transferencia", "usdt", "efectivo", "mercadopago"] as const).flatMap((paymentMethod) =>
    [1, 3, 6, 12].map((installments) => computeTotals({ ...base, paymentMethod, installments }).total),
  );
  assert.deepEqual(new Set(totales), new Set([150_000]));
});

test("el monto por cuota es informativo y redondeado", () => {
  const t = computeTotals({ subtotal: 100_000, coupon: null, shippingCost: 0, paymentMethod: "mercadopago", installments: 3 });
  assert.equal(t.installmentAmount, 33_333);
  assert.equal(t.total, 100_000);
});

test("un cupón más grande que el subtotal no deja el total negativo", () => {
  const t = computeTotals({ subtotal: 5_000, coupon: fijo(9_000), shippingCost: 3_000, paymentMethod: "transferencia", installments: 1 });
  assert.equal(t.total, 3_000);
});

test("el tope de unidades: stock 1 es disponibilidad, solo una cantidad real recorta", () => {
  assert.equal(maxQuantityFor(0), 0);
  assert.equal(maxQuantityFor(1), MAX_QTY_PER_ITEM);
  assert.equal(maxQuantityFor(3), 3);
  assert.equal(maxQuantityFor(50), MAX_QTY_PER_ITEM);
});
