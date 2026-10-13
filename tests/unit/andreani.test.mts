/**
 * Pruebas de la conexión con Andreani que no necesitan red: cómo se leen el
 * peso y las medidas del panel, y cómo se reconocen la credencial y las
 * modalidades de envío.
 *
 * Si las medidas se leen mal, el checkout le pide a Andreani el precio de un
 * paquete equivocado y la tienda cobra de menos (o de más) el envío.
 *
 * Uso: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { medidasDeEnvio, parsearMedidas, parsearPeso } from "../../src/lib/andreani-paquete";
import { modalidadDe, tipoDeCredencial } from "../../src/lib/andreani";


test("peso en kg con punto o coma", () => {
  assert.equal(parsearPeso("0.4 kg"), 0.4);
  assert.equal(parsearPeso("2,5 kg"), 2.5);
  assert.equal(parsearPeso("1"), 1);
});

test("peso en gramos se pasa a kg", () => {
  assert.equal(parsearPeso("400 g"), 0.4);
  assert.equal(parsearPeso("250gr"), 0.25);
});

test("peso vacío o en cero no vale", () => {
  assert.equal(parsearPeso(""), null);
  assert.equal(parsearPeso(null), null);
  assert.equal(parsearPeso("0 kg"), null);
});

test("medidas con ×, x o espacios", () => {
  assert.deepEqual(parsearMedidas("20 × 12 × 6 cm"), { largo: 20, ancho: 12, alto: 6 });
  assert.deepEqual(parsearMedidas("10x10x20 cm"), { largo: 10, ancho: 10, alto: 20 });
  assert.deepEqual(parsearMedidas("21 x 38 x 56"), { largo: 21, ancho: 38, alto: 56 });
});

test("medidas con decimales se redondean y nunca bajan de 1 cm", () => {
  assert.deepEqual(parsearMedidas("20,4 x 0,2 x 6.6 cm"), { largo: 20, ancho: 1, alto: 7 });
});

test("medidas en mm se pasan a cm", () => {
  assert.deepEqual(parsearMedidas("200 x 120 x 60 mm"), { largo: 20, ancho: 12, alto: 6 });
});

test("sin tres medidas no se cotiza", () => {
  assert.equal(parsearMedidas("20 x 12 cm"), null);
  assert.equal(parsearMedidas(""), null);
  assert.equal(medidasDeEnvio({ weight: "1 kg", dimensions: null }), null);
});

test("sin peso se toma 1 kg", () => {
  assert.deepEqual(medidasDeEnvio({ weight: null, dimensions: "30x10x10 cm" }), { largo: 30, ancho: 10, alto: 10, kilos: 1 });
});

test("la credencial PyME se reconoce por su prefijo", () => {
  const pyme = Buffer.from("Pyme|clave-de-prueba").toString("base64").replace(/=+$/, "");
  const corpo = Buffer.from("Corporativo|otra").toString("base64");
  assert.equal(tipoDeCredencial(pyme), "pyme");
  assert.equal(tipoDeCredencial(corpo), "corporativo");
  assert.equal(tipoDeCredencial("cualquier-cosa"), null);
});

test("modalidades de Andreani", () => {
  assert.equal(modalidadDe("A domicilio"), "domicilio");
  assert.equal(modalidadDe("Estándar"), "domicilio");
  assert.equal(modalidadDe("A sucursal"), "sucursal");
  assert.equal(modalidadDe("Llega hoy"), null);
});

test("los precios de Andreani reemplazan la tarifa fija solo en el servicio que cotizó", async () => {
  const { shippingOptions } = await import("../../src/lib/shipping");
  const fijas = shippingOptions("5000");
  const conAndreani = shippingOptions("5000", { estandar: 19304 });
  const costo = (opciones: typeof fijas, id: string) => opciones.find((o) => o.id === id)?.cost;
  assert.equal(costo(conAndreani, "standard"), 19304);
  assert.equal(costo(conAndreani, "express"), costo(fijas, "express"));
  assert.equal(costo(conAndreani, "pickup"), 0);
});
