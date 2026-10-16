/**
 * Pruebas del aviso al terminar la compra.
 *
 * Un pedido por transferencia sin pagar decía "Tu pedido está confirmado":
 * el cliente creía que ya estaba todo, y el pedido vence si no paga.
 *
 * Uso: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { orderBanner } from "../../src/lib/order-banner";

test("transferencia sin pagar: recibido, no confirmado", () => {
  const banner = orderBanner({ customerName: "Ronan Pérez", status: "pendiente_pago", paymentMethod: "transferencia" });
  assert.equal(banner.title, "¡Gracias Ronan! Recibimos tu pedido");
  assert.match(banner.detail ?? "", /Transferí el total y mandanos el comprobante/);
  assert.doesNotMatch(banner.title, /confirmado/);
});

test("Mercado Pago pendiente pide completar el pago", () => {
  const banner = orderBanner({ customerName: "Ana", status: "pendiente_pago", paymentMethod: "mercadopago" });
  assert.equal(banner.title, "¡Gracias Ana! Recibimos tu pedido");
  assert.equal(banner.detail, "Completá el pago para confirmarlo.");
});

test("efectivo en el local: recibido, se paga al retirar", () => {
  const banner = orderBanner({ customerName: "Ana", status: "pendiente_pago", paymentMethod: "efectivo" });
  assert.equal(banner.title, "¡Gracias Ana! Recibimos tu pedido");
  assert.match(banner.detail ?? "", /retirás en el local/);
});

test("con el pago acreditado o después, está confirmado", () => {
  for (const status of ["pago_confirmado", "preparando", "enviado", "entregado"]) {
    const banner = orderBanner({ customerName: "Ana", status, paymentMethod: "transferencia" });
    assert.equal(banner.title, "¡Gracias Ana! Tu pedido está confirmado");
    assert.equal(banner.detail, null);
  }
});

test("sin nombre no queda un espacio suelto", () => {
  assert.equal(orderBanner({ customerName: " ", status: "pago_confirmado", paymentMethod: "mercadopago" }).title, "¡Gracias! Tu pedido está confirmado");
});
