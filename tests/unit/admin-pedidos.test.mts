/**
 * Ayudas de la pantalla de pedidos del panel: link de WhatsApp, estados que se
 * ofrecen a mano (tienen que coincidir con lo que acepta el servidor), el
 * próximo paso sugerido y las fechas relativas en hora de Córdoba.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { allowedStatuses, nextStep, statusSteps, whatsappHref } from "../../src/lib/admin-order-helpers.ts";
import { formatAgo } from "../../src/lib/format.ts";
import { ADMIN_ORDER_STATUSES } from "../../src/lib/pricing.ts";

// `order-status` importa la base; alcanza con una URL que nunca se usa.
process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:1/test";
const { canTransition } = await import("../../src/lib/order-status");

test("whatsappHref arma el número de celular argentino como lo escriben los clientes", () => {
  assert.equal(whatsappHref("351 612-4455"), "https://wa.me/5493516124455");
  assert.equal(whatsappHref("0351 15 612-4455"), "https://wa.me/5493516124455");
  assert.equal(whatsappHref("+54 9 11 4455-6677"), "https://wa.me/5491144556677");
  assert.equal(whatsappHref("011 15 4455-6677"), "https://wa.me/5491144556677");
  assert.equal(whatsappHref("+54 3543 15 41-2233"), "https://wa.me/5493543412233");
  assert.equal(whatsappHref("1234"), null);
  assert.equal(whatsappHref("351 612-4455", "Hola Ana"), "https://wa.me/5493516124455?text=Hola%20Ana");
});

test("allowedStatuses ofrece exactamente los cambios que acepta el servidor", () => {
  for (const from of ADMIN_ORDER_STATUSES) {
    const offered = allowedStatuses(from.id).map((s) => s.id);
    const accepted = ADMIN_ORDER_STATUSES.filter((to) => canTransition(from.id, to.id) === null).map((s) => s.id);
    assert.deepEqual(offered, accepted, `desde ${from.id}`);
  }
});

test("nextStep: Mercado Pago se acredita solo; la transferencia se marca a mano", () => {
  assert.equal(nextStep({ status: "pendiente_pago", paymentMethod: "mercadopago", deliveryMethod: "standard" }).to, null);
  assert.equal(nextStep({ status: "pendiente_pago", paymentMethod: "transferencia", deliveryMethod: "standard" }).to, "pago_confirmado");
  assert.equal(nextStep({ status: "preparando", paymentMethod: "mercadopago", deliveryMethod: "standard" }).asksTracking, true);
  assert.equal(nextStep({ status: "preparando", paymentMethod: "mercadopago", deliveryMethod: "pickup" }).asksTracking, false);
  assert.equal(nextStep({ status: "entregado", paymentMethod: "mercadopago", deliveryMethod: "pickup" }).to, null);
  assert.equal(nextStep({ status: "cancelado", paymentMethod: "transferencia", deliveryMethod: "pickup" }).to, null);
});

test("statusSteps: el paso en curso es uno solo, y entregado queda todo hecho", () => {
  const states = (status: string) => statusSteps(status).map((s) => s.state);
  assert.deepEqual(states("pendiente_pago"), ["current", "todo", "todo", "todo", "todo"]);
  assert.deepEqual(states("preparando"), ["done", "done", "current", "todo", "todo"]);
  assert.deepEqual(states("enviado"), ["done", "done", "done", "current", "todo"]);
  assert.deepEqual(states("entregado"), ["done", "done", "done", "done", "done"]);
  assert.deepEqual(states("cancelado"), ["todo", "todo", "todo", "todo", "todo"]);
});

test("formatAgo usa la hora de Córdoba (UTC-3), no la del servidor", () => {
  const now = new Date("2026-10-13T20:00:00Z"); // 17:00 en Córdoba
  assert.equal(formatAgo(new Date("2026-10-13T19:55:00Z"), now), "hace 5 min");
  assert.equal(formatAgo(new Date("2026-10-13T17:00:00Z"), now), "hace 3 h");
  // 01:30 UTC del 13 son las 22:30 del 12 en Córdoba: es "ayer", no "hoy".
  assert.equal(formatAgo(new Date("2026-10-13T01:30:00Z"), now), "ayer 22:30");
  assert.equal(formatAgo(new Date("2026-10-13T12:00:00Z"), now), "hoy 09:00");
});
