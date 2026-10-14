/**
 * Marca desde el nombre para los productos que quedaron como "General".
 *
 * Uso: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { crearDetectorDeMarca, esMarcaDeRelleno, marcaDesdeNombre } from "../../src/lib/brand-from-name";

test("el monopatín Daihatsu queda Daihatsu", () => {
  assert.equal(marcaDesdeNombre("Monopatin Electrico Daihatsu V101"), "Daihatsu");
  assert.equal(marcaDesdeNombre("Monopatín Eléctrico Dahiatsu V101"), "Daihatsu");
});

test("gana la marca que aparece primero, como palabra entera", () => {
  assert.equal(marcaDesdeNombre("Funda para Samsung A55 compatible con iPhone"), "Samsung");
  assert.equal(marcaDesdeNombre("Cable USB-C largo"), null);
  // "lg" dentro de otra palabra no cuenta.
  assert.equal(marcaDesdeNombre("Bulgaria Vintage Lámpara"), null);
});

test("General Electric es una marca, no un relleno", () => {
  assert.equal(marcaDesdeNombre("Cable HDMI General Electric 3 Metros"), "General Electric");
});

test("alias: iPhone es Apple, Redmi es Xiaomi, PlayStation es Sony", () => {
  assert.equal(marcaDesdeNombre("iPhone 15 Pro 128 GB"), "Apple");
  assert.equal(marcaDesdeNombre("Redmi Note 14 256 GB"), "Xiaomi");
  assert.equal(marcaDesdeNombre("Joystick PlayStation 5 DualSense"), "Sony");
});

test("respeta cómo está escrita la marca en el catálogo y suma las que ya usa", () => {
  const detectar = crearDetectorDeMarca(["Tp-Link", "Kodak", "General", "XX"]);
  assert.equal(detectar("Router TP-Link Archer C6"), "Tp-Link");
  assert.equal(detectar("Cámara Kodak Pixpro FZ55"), "Kodak");
  // Las de relleno y las muy cortas del catálogo no se usan.
  assert.equal(detectar("Mouse General Inalámbrico"), null);
  assert.equal(detectar("Remera talle XX"), null);
});

test("marcas de relleno", () => {
  for (const b of ["General", "Genérica", "", null, " Sin marca "]) assert.ok(esMarcaDeRelleno(b), String(b));
  for (const b of ["Daihatsu", "General Electric"]) assert.ok(!esMarcaDeRelleno(b), b);
});
