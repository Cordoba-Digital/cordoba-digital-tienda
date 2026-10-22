import assert from "node:assert/strict";
import { test } from "node:test";

import {
  fabWhatsAppMessage,
  getWhatsAppProduct,
  setWhatsAppProduct,
  subscribeWhatsAppProduct,
  whatsappLink,
} from "../../src/lib/whatsapp";

test("el botón flotante usa el mismo mensaje que Consultar en una ficha", () => {
  assert.equal(fabWhatsAppMessage("Mouse Logitech G203"), "Hola! Quiero consultar por Mouse Logitech G203");
  assert.equal(fabWhatsAppMessage(null), "Hola Córdoba Digital! Tengo una consulta");
});

test("el link codifica el mensaje", () => {
  assert.equal(
    whatsappLink("Hola! Quiero consultar por Cable 2m & más"),
    "https://wa.me/5493516777774?text=Hola!%20Quiero%20consultar%20por%20Cable%202m%20%26%20m%C3%A1s",
  );
});

test("la ficha anota el producto y al salir vuelve el genérico", () => {
  let calls = 0;
  const unsubscribe = subscribeWhatsAppProduct(() => calls++);
  setWhatsAppProduct("Teclado");
  assert.equal(getWhatsAppProduct(), "Teclado");
  setWhatsAppProduct("Teclado");
  assert.equal(calls, 1);
  setWhatsAppProduct(null);
  assert.equal(getWhatsAppProduct(), null);
  assert.equal(calls, 2);
  unsubscribe();
});
