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

test("Google TV y gateway no son la marca del producto", () => {
  assert.equal(marcaDesdeNombre("Smart Tv Qüint 32″ HD Google Tv"), "Qüint");
  const detectar = crearDetectorDeMarca(["Gateway"]);
  assert.equal(detectar("Gateway 5P HPE Networking Instant 2.5G 64W SG2505P"), null);
  assert.equal(detectar("Google Pixel 9 128 GB"), "Google");
});

test("marcas que habían quedado sin reconocer", () => {
  assert.equal(marcaDesdeNombre("GRANDSTREAM SW L2+ 8 PORT POE GIGA 2SFP"), "Grandstream");
  assert.equal(marcaDesdeNombre("DDR4 16 GB 3200MHZ Basic C16 Netac"), "Netac");
  assert.equal(marcaDesdeNombre("FUENTE COOLERMASTER ELITE V3 600W"), "Cooler Master");
  assert.equal(marcaDesdeNombre("MONITOR LED 24 E-VIEW 2351RAY HDMI/DP 100HZ"), "E-View");
  assert.equal(marcaDesdeNombre("TL-LINK AP BE9300 TRI-BAND WIFI 7 IN"), "TP-Link");
  assert.equal(marcaDesdeNombre("HIK KIT INTERCOM HIBRIDO DS-KIS302-P"), "Hikvision");
  assert.equal(marcaDesdeNombre("EVOLVE2 65 LINK380A MS BLACK"), "Jabra");
  assert.equal(marcaDesdeNombre("Parlante Harman Kardon Aura Studio 3"), "Harman Kardon");
});
