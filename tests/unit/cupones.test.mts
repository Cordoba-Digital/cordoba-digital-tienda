/**
 * Reglas de los cupones que no necesitan base: cuándo se pueden usar y cómo
 * se lee la fecha de vencimiento que carga el panel.
 *
 * Uso: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";

// Los módulos importan la base; alcanza con una URL que nunca se usa.
process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:1/test";
const { couponProblem } = await import("../../src/lib/coupons");
const { endOfDayCordoba, toIsoDateCordoba } = await import("../../src/lib/admin-coupons");

const ahora = new Date("2026-10-12T15:00:00Z");
const base = { active: true, expiresAt: null, maxUses: null, usedCount: 0 };

test("un cupón activo, sin vencimiento ni tope, se puede usar", () => {
  assert.equal(couponProblem(base, ahora), null);
});

test("pausado, vencido o agotado no se puede usar", () => {
  assert.equal(couponProblem({ ...base, active: false }, ahora), "inactivo");
  assert.equal(couponProblem({ ...base, expiresAt: new Date("2026-10-12T14:59:59Z") }, ahora), "vencido");
  assert.equal(couponProblem({ ...base, maxUses: 3, usedCount: 3 }, ahora), "agotado");
  assert.equal(couponProblem({ ...base, maxUses: 3, usedCount: 2 }, ahora), null);
});

test("el vencimiento es el último instante de ese día en Córdoba", () => {
  const vence = endOfDayCordoba("2026-10-12")!;
  assert.equal(vence.toISOString(), "2026-10-13T02:59:59.999Z");
  assert.equal(couponProblem({ ...base, expiresAt: vence }, new Date("2026-10-13T02:59:00Z")), null);
  assert.equal(couponProblem({ ...base, expiresAt: vence }, new Date("2026-10-13T03:00:00Z")), "vencido");
  assert.equal(toIsoDateCordoba(vence), "2026-10-12");
});

test("fechas inexistentes o mal escritas no se aceptan", () => {
  assert.equal(endOfDayCordoba("2026-02-31"), null);
  assert.equal(endOfDayCordoba("12/10/2026"), null);
  assert.equal(endOfDayCordoba(""), null);
});
