/**
 * Pruebas del aviso al terminar la compra.
 *
 * Un pedido se confirma con la plata acreditada. Mientras espera el pago no
 * dice "gracias" ni "recibimos": dice que falta el pago y cómo completarlo.
 *
 * Uso: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { orderBanner, orderCodeLabel } from "../../src/lib/order-banner";

const PENDIENTE = "Falta el pago para confirmar tu pedido";

test("transferencia sin pagar: falta el pago, sin gracias", () => {
  const banner = orderBanner({ customerName: "Ronan Pérez", status: "pendiente_pago", paymentMethod: "transferencia", total: 50000 });
  assert.equal(banner.tone, "pendiente");
  assert.equal(banner.title, PENDIENTE);
  assert.match(banner.detail ?? "", /Transferí el total con los datos de abajo y mandanos el comprobante/);
  assert.doesNotMatch(`${banner.title} ${banner.detail}`, /Gracias|Recibimos|confirmado/);
});

test("Mercado Pago sin pagar pide completar el pago", () => {
  const banner = orderBanner({ customerName: "Ana", status: "pendiente_pago", paymentMethod: "mercadopago", total: 50000 });
  assert.equal(banner.title, PENDIENTE);
  assert.equal(banner.detail, "Completá el pago en Mercado Pago para confirmarlo.");
});

test("efectivo en el local: falta el pago, se paga al retirar", () => {
  const banner = orderBanner({ customerName: "Ana", status: "pendiente_pago", paymentMethod: "efectivo", total: 50000 });
  assert.equal(banner.title, PENDIENTE);
  assert.match(banner.detail ?? "", /retirás en el local/);
});

test("con el pago acreditado o después, gracias y confirmado", () => {
  for (const status of ["pago_confirmado", "preparando", "enviado", "entregado"]) {
    const banner = orderBanner({ customerName: "Ana", status, paymentMethod: "transferencia", total: 50000 });
    assert.equal(banner.tone, "confirmado");
    assert.equal(banner.title, "¡Gracias Ana! Tu pedido está confirmado");
    assert.equal(banner.detail, null);
  }
});

test("cancelado no dice gracias ni confirmado", () => {
  for (const paymentMethod of ["transferencia", "efectivo", "mercadopago"]) {
    const banner = orderBanner({ customerName: "Ronan", status: "cancelado", paymentMethod, total: 50000 });
    assert.equal(banner.tone, "cancelado");
    assert.doesNotMatch(banner.title, /Gracias|confirmado/);
  }
});

test("sin nombre no queda un espacio suelto", () => {
  assert.equal(
    orderBanner({ customerName: " ", status: "pago_confirmado", paymentMethod: "mercadopago", total: 50000 }).title,
    "¡Gracias! Tu pedido está confirmado",
  );
});

test("sin pago es una orden; con la seña, reserva; con el pago, pedido", () => {
  assert.deepEqual(orderCodeLabel("pendiente_pago"), { label: "Número de orden", noun: "Orden" });
  assert.deepEqual(orderCodeLabel("pendiente_pago", "sena"), { label: "Número de orden", noun: "Orden" });
  assert.deepEqual(orderCodeLabel("pago_confirmado", "sena"), { label: "Código de reserva", noun: "Reserva" });
  assert.deepEqual(orderCodeLabel("cancelado", "sena"), { label: "Número de pedido", noun: "Pedido" });
  assert.deepEqual(orderCodeLabel("pago_confirmado", "transferencia"), { label: "Número de pedido", noun: "Pedido" });
  assert.deepEqual(orderCodeLabel("entregado"), { label: "Número de pedido", noun: "Pedido" });
});

test("seña sin pagar: pide la seña, no el total", () => {
  const banner = orderBanner({ customerName: "Ana", status: "pendiente_pago", paymentMethod: "sena", total: 50000 });
  assert.equal(banner.tone, "pendiente");
  assert.equal(banner.title, "Falta la seña para confirmar tu reserva");
  assert.match(banner.detail ?? "", /seña de \$\s?10\.000/);
});

test("seña acreditada: la reserva queda confirmada", () => {
  const banner = orderBanner({ customerName: "Ana", status: "pago_confirmado", paymentMethod: "sena", total: 50000 });
  assert.equal(banner.tone, "confirmado");
  assert.equal(banner.title, "¡Gracias Ana! Tu reserva está confirmada");
});
