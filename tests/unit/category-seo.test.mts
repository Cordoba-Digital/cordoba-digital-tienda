/**
 * Pruebas del JSON-LD y las preguntas frecuentes de las categorías. Lo que
 * importa: que el precio del listado sea el mismo número que la ficha (pesos
 * enteros), que un producto sin precio no aparezca como gratis y que el FAQ no
 * invente datos cuando el catálogo no los tiene.
 *
 * Uso: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { categoryFaq, categoryItemListJsonLd, faqPageJsonLd } from "../../src/lib/category-seo";
import { url } from "../../src/lib/site";

const celular = {
  slug: "redmi-note-14",
  name: "Xiaomi Redmi Note 14",
  brand: "Xiaomi",
  price: 583861,
  stock: 3,
  images: ["/api/imagenes/redmi.webp"],
};

test("el listado lleva un Product con el precio en pesos enteros y el @id de la ficha", () => {
  const jsonLd = categoryItemListJsonLd({ name: "Celulares", total: 50, offset: 24, items: [celular] });
  const [elemento] = jsonLd.itemListElement;
  assert.equal(elemento.position, 25);
  assert.equal(elemento.item["@id"], `${url("/producto/redmi-note-14")}#product`);
  assert.equal(elemento.item.image, url("/api/imagenes/redmi.webp"));
  assert.deepEqual(elemento.item.offers, {
    "@type": "Offer",
    priceCurrency: "ARS",
    price: 583861,
    availability: "https://schema.org/InStock",
    url: url("/producto/redmi-note-14"),
  });
});

test("sin precio no hay oferta y sin stock figura agotado", () => {
  const [sinPrecio, agotado] = categoryItemListJsonLd({
    name: "Celulares",
    total: 2,
    offset: 0,
    items: [
      { ...celular, slug: "a", price: 0 },
      { ...celular, slug: "b", stock: 0, brand: "General", images: [] },
    ],
  }).itemListElement;
  assert.equal("offers" in sinPrecio.item, false);
  assert.equal(agotado.item.offers?.availability, "https://schema.org/OutOfStock");
  assert.equal("brand" in agotado.item, false);
  assert.equal("image" in agotado.item, false);
});

test("el FAQ arma el rango de precios y las marcas con datos del catálogo", () => {
  const faq = categoryFaq("Celulares", {
    total: 120,
    inStock: 80,
    minPrice: 150000,
    maxPrice: 2500000,
    brands: [
      { brand: "General", count: 99 },
      { brand: "Motorola", count: 10 },
      { brand: "Samsung", count: 40 },
      { brand: "Xiaomi", count: 40 },
    ],
  });
  const precios = faq.find((f) => f.pregunta.startsWith("¿Cuánto salen"));
  assert.ok(precios);
  assert.match(precios.respuesta, /120 productos/);
  assert.match(precios.respuesta, /desde \$\s?150\.000 hasta \$\s?2\.500\.000/);
  assert.match(precios.respuesta, /80 tienen stock/);
  const marcas = faq.find((f) => f.pregunta.includes("marcas"));
  assert.equal(marcas?.respuesta.includes("Samsung, Xiaomi y Motorola"), true);
  assert.equal(marcas?.respuesta.includes("General"), false);
});

test("sin productos ni marcas solo quedan las preguntas de la tienda", () => {
  const faq = categoryFaq("Drones", { total: 0, inStock: 0, minPrice: null, maxPrice: null, brands: [] });
  assert.deepEqual(
    faq.map((f) => f.pregunta),
    [
      "¿Hacen envíos de Drones a todo el país?",
      "¿Qué garantía tienen los productos de Drones?",
      "¿Puedo ver Drones en un local físico?",
    ],
  );
});

test("el FAQPage repite exactamente las preguntas visibles", () => {
  const faq = categoryFaq("Drones", { total: 0, inStock: 0, minPrice: null, maxPrice: null, brands: [] });
  const jsonLd = faqPageJsonLd(faq);
  assert.deepEqual(
    jsonLd.mainEntity.map((q) => [q.name, q.acceptedAnswer.text]),
    faq.map((f) => [f.pregunta, f.respuesta]),
  );
});
