import assert from "node:assert/strict";
import { test } from "node:test";

import { formatUsdt, toMicroUsdt, usdFor, usdtAmountFor, usdtShortfall } from "../../src/lib/usdt-amount.ts";

test("usdtAmountFor pasa pesos a USDT redondeando para arriba al centavo", () => {
  assert.equal(usdtAmountFor(108_331, 1_475), "73.45"); // 73,4447… → 73,45
  assert.equal(usdtAmountFor(147_500, 1_475), "100.00"); // exacto, sin centavo de más
  assert.equal(usdtAmountFor(100_000, 1_474.5), "67.82"); // 67,8195… → 67,82
  assert.equal(usdtAmountFor(1, 1_475), "0.01");
  assert.throws(() => usdtAmountFor(1_000, 0));
});

test("usdtShortfall dice cuánto falta, sin errores de float", () => {
  assert.equal(usdtShortfall("73.45", "73.45"), "0");
  assert.equal(usdtShortfall("80", "73.45"), "0");
  assert.equal(usdtShortfall("72.45", "73.45"), "1");
  assert.equal(usdtShortfall("73.449999", "73.45"), "0.000001");
  assert.equal(usdtShortfall("0.1", "0.3"), "0.2");
});

test("toMicroUsdt y formatUsdt", () => {
  assert.equal(toMicroUsdt("1.5"), BigInt(1_500_000));
  assert.equal(toMicroUsdt("1.1234567"), null);
  assert.equal(toMicroUsdt("-1"), null);
  assert.equal(formatUsdt("73.45"), "73,45");
});

test("usdFor da dólares enteros para la ficha, para arriba, y nada sin cotización", () => {
  assert.equal(usdFor(1_499_999, 1_500), 1000); // 999,9993… → 1000
  assert.equal(usdFor(1_500_000, 1_500), 1000); // exacto
  assert.equal(usdFor(1_500_001, 1_500), 1001); // centavo de más → dólar de más, como el cobro
  assert.equal(usdFor(1_499_999, null), null);
  assert.equal(usdFor(0, 1_500), null);
});
