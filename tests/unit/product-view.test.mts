/**
 * Lo que viaja al navegador por cada tarjeta de producto.
 *
 * Uso: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { toCardView, toView, type CardRow } from "../../src/lib/product-view";

const fila: CardRow = {
  slug: "iphone-16",
  name: "iPhone 16",
  brand: "Apple",
  categorySlug: "celulares",
  shortDescription: "Una descripción larga que la tarjeta no muestra.",
  price: 1_500_000,
  compareAtPrice: 1_700_000,
  stock: 3,
  rating: 45,
  reviewCount: 12,
  soldCount: 30,
  images: ["https://ejemplo.com/a.jpg", "https://ejemplo.com/b.jpg", "https://ejemplo.com/c.jpg"],
  imageSrcSets: [["https://ejemplo.com/a-300.jpg 300w"], ["https://ejemplo.com/b-300.jpg 300w"], ["https://ejemplo.com/c-300.jpg 300w"]],
  badge: null,
  freeShipping: true,
  highlights: ["128 GB", "Cámara doble"],
};

test("la tarjeta lleva solo las dos primeras fotos y sin descripción", () => {
  const card = toCardView(fila);
  assert.equal(card.images.length, 2);
  assert.equal(card.imageSrcSets.length, 2);
  assert.equal(card.shortDescription, "");
  assert.deepEqual(card.highlights, []);
});

test("la tarjeta conserva lo que muestra: precio, stock, foto y reseñas", () => {
  const card = toCardView(fila);
  const full = toView(fila);
  for (const key of ["slug", "name", "brand", "price", "compareAtPrice", "stock", "rating", "reviewCount", "soldCount", "image", "badge", "freeShipping"] as const) {
    assert.deepEqual(card[key], full[key], key);
  }
  assert.deepEqual(card.images, full.images.slice(0, 2));
});
