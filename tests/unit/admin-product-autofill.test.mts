/**
 * Autocompletado del alta de productos: lo que se deduce del nombre y los
 * textos sugeridos para Google.
 *
 * Uso: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { guessFromName, similarityTerms, suggestSeo } from "../../src/lib/admin-product-autofill.ts";

const marcas = ["Samsung", "Motorola", "Apple", "Xiaomi", "TP-Link", "HP"];

test("celular con el nombre como pide la guía", () => {
  const g = guessFromName("Samsung Galaxy A56 5G 256 GB 8 GB RAM", marcas);
  assert.equal(g.brand, "Samsung");
  assert.equal(g.model, "Galaxy A56 5G");
  assert.equal(g.storage, "256 GB");
  assert.equal(g.ram, "8 GB");
  assert.equal(g.condition, "");
  assert.equal(g.cleanName, "");
});

test("nombre escrito a las apuradas: marca por la línea, memorias sin aclarar", () => {
  const g = guessFromName("iphone 13 128gb usado", marcas);
  assert.equal(g.brand, "Apple");
  assert.equal(g.model, "iPhone 13");
  assert.equal(g.storage, "128 GB");
  assert.equal(g.ram, "");
  assert.equal(g.condition, "Usado");
  assert.equal(g.cleanName, "iPhone 13 128 GB Usado");

  const m = guessFromName("motorola moto g35 5g 256gb 8gb", marcas);
  assert.equal(m.brand, "Motorola");
  assert.equal(m.storage, "256 GB");
  assert.equal(m.ram, "8 GB");
  assert.equal(m.model, "Moto G35 5G");
  assert.equal(m.cleanName, "Motorola Moto G35 5G 256 GB 8 GB RAM");
});

test("notebook con TB y RAM aclarada", () => {
  const g = guessFromName("Notebook HP 15 Ryzen 5 16 GB RAM 1 TB SSD", marcas);
  assert.equal(g.brand, "HP");
  assert.equal(g.ram, "16 GB");
  assert.equal(g.storage, "1 TB");
});

test("sin memorias ni marca conocida no inventa nada", () => {
  const g = guessFromName("Aire acondicionado BGH 3300 W", marcas);
  assert.equal(g.brand, "");
  assert.equal(g.storage, "");
  assert.equal(g.ram, "");
  assert.deepEqual(guessFromName("ab", marcas), { brand: "", model: "", storage: "", ram: "", condition: "", cleanName: "" });
});

test("las palabras para buscar parecidos son las del modelo, sin memorias", () => {
  assert.deepEqual(similarityTerms("Samsung Galaxy A56 5G 512 GB 12 GB RAM", marcas), ["samsung", "galaxy", "a56", "5g"]);
});

test("textos para Google dentro de los largos de la guía", () => {
  const seo = suggestSeo({
    name: "Samsung Galaxy A56 5G 256 GB 8 GB RAM con cargador original incluido",
    shortDescription: "Pantalla Super AMOLED de 6,7 pulgadas, cámara de 50 MP y batería de 5000 mAh para todo el día, con carga rápida de 45 W y un año de actualizaciones garantizadas.",
    condition: "Nuevo",
  });
  assert.ok(seo.title.length <= 45, seo.title);
  assert.ok(seo.description.length <= 160, String(seo.description.length));
  assert.match(seo.description, /Nuevo, con garantía y envíos a todo el país\.$/);
});
