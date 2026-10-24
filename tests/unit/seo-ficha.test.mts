/**
 * Lo que la ficha le dice a Google tiene que coincidir con el feed de Merchant
 * Center, y las marcas viejas del WordPress (`/marca/apple`) tienen que
 * encontrar productos aunque lleguen en minúscula.
 *
 * Uso: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { marcasDelFiltro } from "../../src/lib/brand-filter";
import { feedCondition, renderItem, type FeedProduct } from "../../src/lib/merchant-feed";
import { brandSchema, itemConditionSchema } from "../../src/lib/structured-data";

test("el filtro de marcas compara sin distinguir mayúsculas", () => {
  // Así llegan desde /marca/apple y /marca/tp-link del WordPress viejo.
  assert.deepEqual(marcasDelFiltro(["apple", "tp-link"]), ["apple", "tp-link"]);
  // Y así desde el panel de filtros, con el nombre guardado en la base.
  assert.deepEqual(marcasDelFiltro(["Apple", "TP-Link"]), ["apple", "tp-link"]);
  assert.deepEqual(marcasDelFiltro(["Apple", "apple", " ", ""]), ["apple"]);
});

test("el estado de la ficha es el mismo que el del feed", () => {
  const casos: [string, string, string][] = [
    ["Nuevo", "new", "https://schema.org/NewCondition"],
    ["", "new", "https://schema.org/NewCondition"],
    ["Reacondicionado", "refurbished", "https://schema.org/RefurbishedCondition"],
    ["Usado", "used", "https://schema.org/UsedCondition"],
  ];
  for (const [estado, feed, ficha] of casos) {
    assert.equal(feedCondition(estado), feed, estado);
    assert.equal(itemConditionSchema(estado), ficha, estado);
  }
});

test("las marcas de relleno no salen ni en la ficha ni en el feed", () => {
  assert.equal(brandSchema("General"), null);
  assert.equal(brandSchema("Genérico"), null);
  assert.equal(brandSchema(""), null);
  assert.deepEqual(brandSchema(" Sony "), { "@type": "Brand", name: "Sony" });

  const producto: FeedProduct = {
    slug: "cable-usb",
    name: "Cable USB",
    brand: "Genérico",
    categorySlug: "accesorios",
    shortDescription: "Cable",
    description: "",
    descriptionHtml: "",
    price: 5000,
    compareAtPrice: null,
    stock: 1,
    images: ["https://example.com/cable.webp"],
    condition: "Nuevo",
    freeShipping: false,
  };
  const item = renderItem(producto, "Accesorios");
  assert.doesNotMatch(item, /<g:brand>/);
  assert.match(item, /<g:identifier_exists>no<\/g:identifier_exists>/);
  assert.match(renderItem({ ...producto, brand: "Sony" }, "Accesorios"), /<g:brand>Sony<\/g:brand>/);
});
