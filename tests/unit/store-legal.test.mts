import assert from "node:assert/strict";
import { test } from "node:test";

import { dataFiscalUrl, formatCuit, storeLegal } from "../../src/lib/store-legal";

test("formatCuit acepta 11 números con o sin guiones", () => {
  assert.equal(formatCuit("20123456789"), "20-12345678-9");
  assert.equal(formatCuit(" 20-12345678-9 "), "20-12345678-9");
  assert.equal(formatCuit("2012345678"), "");
  assert.equal(formatCuit(""), "");
});

test("dataFiscalUrl solo deja pasar links de ARCA y los pasa a https", () => {
  assert.equal(dataFiscalUrl("http://qr.afip.gob.ar/?qr=AbC123"), "https://qr.afip.gob.ar/?qr=AbC123");
  assert.equal(dataFiscalUrl("https://qr.arca.gob.ar/?qr=AbC123"), "https://qr.arca.gob.ar/?qr=AbC123");
  assert.equal(dataFiscalUrl("https://qr.afip.gob.ar.example.com/?qr=AbC123"), "");
  assert.equal(dataFiscalUrl("https://example.com/?qr=AbC123"), "");
  assert.equal(dataFiscalUrl("http://qr.afip.gob.ar/"), "");
  assert.equal(dataFiscalUrl("javascript:alert(1)"), "");
  assert.equal(dataFiscalUrl(""), "");
});

test("storeLegal sin variables no imprime nada", () => {
  assert.deepEqual(storeLegal({}), { razonSocial: "", cuit: "", dataFiscalUrl: "" });
});

test("storeLegal lee las tres variables", () => {
  const legal = storeLegal({
    STORE_RAZON_SOCIAL: "  Ejemplo S.R.L. ",
    STORE_CUIT: "30-71234567-8",
    STORE_DATA_FISCAL_URL: "http://qr.afip.gob.ar/?qr=XyZ",
  });
  assert.deepEqual(legal, { razonSocial: "Ejemplo S.R.L.", cuit: "30-71234567-8", dataFiscalUrl: "https://qr.afip.gob.ar/?qr=XyZ" });
});
