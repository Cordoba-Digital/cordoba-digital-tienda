/**
 * Tope redondo del bloque "Por menos de $X" de la home.
 *
 * Uso: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { roundPriceCap } from "../../src/lib/format";

test("sube al siguiente tope redondo", () => {
  assert.equal(roundPriceCap(99_999), 100_000);
  assert.equal(roundPriceCap(100_000), 100_000);
  assert.equal(roundPriceCap(35_378), 50_000);
  assert.equal(roundPriceCap(120_001), 150_000);
  assert.equal(roundPriceCap(560_000), 750_000);
  assert.equal(roundPriceCap(800_000), 1_000_000);
});

test("sin precios no hay tope", () => {
  assert.equal(roundPriceCap(0), 0);
  assert.equal(roundPriceCap(Number.NaN), 0);
  assert.equal(roundPriceCap(-5), 0);
});
