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

import { orderBanner } from "../../src/lib/order-banner";

const PENDIENTE = "Falta el pago para confirmar tu pedido";

test("transferencia sin pagar: falta el pago, sin gracias", () => {
  const banner = orderBanner({ customerName: "Ronan Pérez", status: "pendiente_pago", paymentMethod: "transferencia" });
  assert.equal(banner.tone, "pendiente");
  assert.equal(banner.title, PENDIENTE);
  assert.match(banner.detail ?? "", /Transferí el total con los datos de abajo y mandanos el comprobante/);
  assert.doesNotMatch(`${banner.title} ${banner.detail}`, /Gracias|Recibimos|confirmado/);
});

test("Mercado Pago sin pagar pide completar el pago", () => {
  const banner = orderBanner({ customerName: "Ana", status: "pendiente_pago", paymentMethod: "mercadopago" });
  assert.equal(banner.title, PENDIENTE);
  assert.equal(banner.detail, "Completá el pago en Mercado Pago para confirmarlo.");
});

test("efectivo en el local: falta el pago, se paga al retirar", () => {
  const banner = orderBanner({ customerName: "Ana", status: "pendiente_pago", paymentMethod: "efectivo" });
  assert.equal(banner.title, PENDIENTE);
  assert.match(banner.detail ?? "", /retirás en el local/);
});

test("con el pago acreditado o después, gracias y confirmado", () => {
  for (const status of ["pago_confirmado", "preparando", "enviado", "entregado"]) {
    const banner = orderBanner({ customerName: "Ana", status, paymentMethod: "transferencia" });
    assert.equal(banner.tone, "confirmado");
    assert.equal(banner.title, "¡Gracias Ana! Tu pedido está confirmado");
    assert.equal(banner.detail, null);
  }
});

test("sin nombre no queda un espacio suelto", () => {
  assert.equal(
    orderBanner({ customerName: " ", status: "pago_confirmado", paymentMethod: "mercadopago" }).title,
    "¡Gracias! Tu pedido está confirmado",
  );
});
