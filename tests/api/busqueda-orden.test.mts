/**
 * Orden del desplegable del buscador: lo que se busca va primero aunque otro
 * producto se venda más o mencione la palabra. Casos reales: "celulares" traía
 * primero un parlante de Accesorios P/ Celulares, "camaras" traía celulares
 * (dicen "cámara" en la descripción) y en "aires acondicionados" el caloventor
 * quedaba arriba de los aires.
 *
 * Uso: npm run test:api (con DATABASE_URL a una base local migrada)
 */
import assert from "node:assert/strict";
import { after, test } from "node:test";

import { sql } from "drizzle-orm";

import { db, pool, resetDb, schema } from "./db.mts";

const { searchProducts, searchShortcuts } = await import("../../src/lib/queries");

await resetDb();
await db.execute(sql`truncate table categories, product_categories restart identity cascade`);
await db.insert(schema.categories).values([
  { slug: "celulares-cordoba", name: "CELULARES LIBERADOS" },
  { slug: "accesorios-p-celulares", name: "ACCESORIOS P/ CELULARES" },
  { slug: "camaras-digitales", name: "CÁMARAS DIGITALES Y FOTO" },
  { slug: "aires-acondicionados", name: "AIRES ACONDICIONADOS" },
]);

const productos = [
  { slug: "iphone-16", name: "iPhone 16 128 GB", brand: "Apple", categorySlug: "celulares-cordoba", soldCount: 5, shortDescription: "Cámara de 48 MP" },
  { slug: "moto-g06", name: "Motorola Moto G06", brand: "Motorola", categorySlug: "celulares-cordoba", soldCount: 3, shortDescription: "Doble cámara" },
  { slug: "parlante-jbl", name: "Parlante JBL Xtreme 4", brand: "JBL", categorySlug: "accesorios-p-celulares", soldCount: 50 },
  { slug: "nikon-d750", name: "Nikon D750 Body", brand: "Nikon", categorySlug: "camaras-digitales", soldCount: 0 },
  { slug: "tripode", name: "Trípode para cámara", brand: "General", categorySlug: "camaras-digitales", soldCount: 0 },
  { slug: "aire-bgh", name: "Aire Acondicionado BGH 5000W", brand: "BGH", categorySlug: "aires-acondicionados", soldCount: 1 },
  { slug: "caloventor", name: "Caloventor Split de Pared Peabody", brand: "Peabody", categorySlug: "aires-acondicionados", soldCount: 20 },
  { slug: "ventilador", name: "Ventilador Turbo Liliana", brand: "Liliana", categorySlug: "aires-acondicionados", soldCount: 30 },
];
const insertados = await db.insert(schema.products).values(productos.map((p) => ({ ...p, price: 100000, stock: 3 }))).returning();
const cats = await db.select().from(schema.categories);
await db.insert(schema.productCategories).values(
  insertados.map((p) => ({ productId: p.id, categoryId: cats.find((c) => c.slug === p.categorySlug)!.id })),
);

after(async () => {
  await db.execute(sql`truncate table categories, product_categories restart identity cascade`);
  await pool.end();
});

const slugs = async (q: string) => (await searchProducts(q, 6)).map((p) => p.slug);

test("celulares: los celulares antes que el parlante de Accesorios, aunque se venda más", async () => {
  const r = await slugs("celulares");
  assert.deepEqual(r.slice(0, 2), ["iphone-16", "moto-g06"]);
});

test("camaras: las cámaras antes que los celulares que dicen cámara en la descripción", async () => {
  const r = await slugs("camaras");
  assert.deepEqual(r.slice(0, 2).sort(), ["nikon-d750", "tripode"]);
});

test("aires acondicionados: el aire antes que el caloventor y el ventilador de la misma categoría", async () => {
  const r = await slugs("aires acondicionados");
  assert.equal(r[0], "aire-bgh");
  assert.deepEqual(r.slice(1).sort(), ["caloventor", "ventilador"]);
});

test("los atajos no sugieren marcas de relleno como General", async () => {
  const labels = (await searchShortcuts("camaras")).map((s) => s.label);
  assert.ok(labels.includes("Cámaras Digitales y Foto"), labels.join(", "));
  assert.ok(!labels.some((l) => l.endsWith(" General")), labels.join(", "));
});
