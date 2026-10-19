/**
 * Textos de los emails que recibe el cliente cuando cambia el estado del pedido.
 *
 * Uso: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";

// `order-emails` importa la base; alcanza con una URL que nunca se usa.
process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:1/test";
const { orderStatusEmail } = await import("../../src/lib/order-emails");

const pedido = {
  code: "CD-ABC234",
  customerName: "Ana María Pérez",
  email: "ana@example.com",
  deliveryMethod: "standard",
  total: 250_000,
  trackingCode: "",
};

test("el pago acreditado saluda por el nombre, dice el monto y enlaza el pedido", () => {
  const mail = orderStatusEmail(pedido, "pago_confirmado")!;
  assert.equal(mail.subject, "Recibimos el pago de tu pedido CD-ABC234");
  assert.match(mail.text, /^Hola Ana,/);
  assert.match(mail.text, /\$\s?250\.000/);
  assert.match(mail.text, /\/pedido\/CD-ABC234$/m);
});

test("en camino con y sin código de seguimiento, y listo para retirar si es retiro", () => {
  assert.match(orderStatusEmail({ ...pedido, trackingCode: "AR123" }, "enviado")!.text, /seguimiento es AR123/);
  assert.match(orderStatusEmail(pedido, "enviado")!.text, /En cuanto tengamos el código/);
  assert.equal(
    orderStatusEmail({ ...pedido, deliveryMethod: "pickup" }, "enviado")!.subject,
    "Tu pedido CD-ABC234 está listo para retirar",
  );
});

test("un pedido vencido explica las 48 horas; uno cancelado a mano, no", () => {
  assert.match(orderStatusEmail(pedido, "cancelado", "Vencido: sin pago en 48 hs.")!.text, /48 horas/);
  assert.doesNotMatch(orderStatusEmail(pedido, "cancelado", "Lo pidió el cliente")!.text, /48 horas/);
  assert.match(orderStatusEmail(pedido, "cancelado", "Vencido: sin pago en 24 hs.")!.text, /24 horas/);
});

test("pedido recibido no manda email", () => {
  assert.equal(orderStatusEmail(pedido, "pendiente_pago"), null);
});
