import assert from "node:assert/strict";
import { test } from "node:test";

import { customerMail, tramiteCode } from "../../src/lib/arrepentimiento";

const solicitud = {
  id: 42,
  nombre: "Ana Pérez",
  email: "ana@example.com",
  numeroPedido: "CD-ABC123",
  telefono: "351 555-1234",
  fechaCompra: "2026-10-20",
  producto: "iPhone 15",
  comentarios: "",
  createdAt: new Date("2026-10-22T15:00:00Z"),
};

test("el código de trámite sale del id", () => {
  assert.equal(tramiteCode(42), "ARR-00042");
  assert.equal(tramiteCode(123456), "ARR-123456");
});

test("el email al cliente lleva el código, el producto y el pedido", () => {
  const mail = customerMail(solicitud);
  assert.equal(mail.to, "ana@example.com");
  assert.match(mail.subject, /ARR-00042/);
  assert.match(mail.text, /^Hola Ana:/);
  assert.match(mail.text, /Código de trámite: ARR-00042/);
  assert.match(mail.text, /Fecha de la solicitud: 22\/10\/2026/);
  assert.match(mail.text, /Producto: iPhone 15/);
  assert.match(mail.text, /Pedido: CD-ABC123/);
});

test("no sirve para mandar links ni textos largos a cualquier dirección", () => {
  const mail = customerMail({ ...solicitud, nombre: "Ganaste", producto: `Entrá a https://estafa.example/x y www.otra.example ${"a".repeat(500)}` });
  assert.doesNotMatch(mail.text, /estafa\.example|otra\.example/);
  const producto = mail.text.split("\n").find((l) => l.startsWith("Producto: "))!;
  assert.ok(producto.length <= "Producto: ".length + 120);
});
