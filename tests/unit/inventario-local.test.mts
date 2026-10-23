/**
 * Inventario local para Merchant Center: el mismo id del feed principal, el
 * código de tienda y la cantidad del local.
 *
 * Uso: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { renderLocalFeed, renderLocalItem, STORE_CODE } from "../../src/lib/merchant-feed";

test("con stock: cantidad, disponible y retiro en el día", () => {
  const item = renderLocalItem({ slug: "xiaomi-redmi-13", stock: 4 }, "CBA1");
  assert.match(item, /<g:id>xiaomi-redmi-13<\/g:id>/);
  assert.match(item, /<g:store_code>CBA1<\/g:store_code>/);
  assert.match(item, /<g:availability>in stock<\/g:availability>/);
  assert.match(item, /<g:quantity>4<\/g:quantity>/);
  assert.match(item, /<g:pickup_method>buy<\/g:pickup_method>/);
  assert.match(item, /<g:pickup_sla>same day<\/g:pickup_sla>/);
});

test("sin stock: agotado, cantidad 0 y sin retiro", () => {
  const item = renderLocalItem({ slug: "agotado", stock: -2 });
  assert.match(item, new RegExp(`<g:store_code>${STORE_CODE}</g:store_code>`));
  assert.match(item, /<g:availability>out of stock<\/g:availability>/);
  assert.match(item, /<g:quantity>0<\/g:quantity>/);
  assert.doesNotMatch(item, /pickup/);
});

test("el feed es RSS con el namespace de Google", () => {
  const xml = renderLocalFeed([renderLocalItem({ slug: "a", stock: 1 })], new Date(0));
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.match(xml, /xmlns:g="http:\/\/base.google.com\/ns\/1.0"/);
});
