/**
 * Búsqueda del catálogo contra la base: "celular samsung" tiene que traer el
 * Samsung de Celulares aunque ningún nombre diga "celular samsung", sin colar
 * el televisor Samsung ni la funda.
 *
 * Uso: npm run test:api (con DATABASE_URL a una base local migrada)
 */
import assert from "node:assert/strict";
import { after, test } from "node:test";

import { sql } from "drizzle-orm";

import { db, pool, resetDb, schema } from "./db.mts";

const { listProducts, searchProducts, searchShortcuts, understandCatalogQuery } = await import("../../src/lib/queries");

await resetDb();
await db.execute(sql`truncate table categories, product_categories restart identity cascade`);
const [celulares] = await db.insert(schema.categories).values({ slug: "celulares", name: "CELULARES" }).returning();
await db.insert(schema.categories).values({ slug: "televisores", name: "TELEVISORES" });
await db.insert(schema.categories).values({ slug: "accesorios-p-celulares", name: "ACCESORIOS P/ CELULARES" });

const productos = [
  { slug: "galaxy-a55", name: "Samsung Galaxy A55 128GB", brand: "Samsung", categorySlug: "celulares" },
  { slug: "galaxy-a15", name: "Samsung Galaxy A15 128GB", brand: "Samsung", categorySlug: "celulares" },
  { slug: "iphone-15", name: "iPhone 15 128GB", brand: "Apple", categorySlug: "celulares" },
  { slug: "tv-samsung", name: "Smart TV Samsung 50\"", brand: "Samsung", categorySlug: "televisores" },
  { slug: "funda-a55", name: "Funda para Samsung A55", brand: "Generica", categorySlug: "accesorios-p-celulares" },
  { slug: "camara", name: "Cámara de seguridad WiFi", brand: "Imou", categorySlug: "accesorios-p-celulares" },
];
const insertados = await db.insert(schema.products).values(productos.map((p) => ({ ...p, price: 100000, stock: 3 }))).returning();
// El puente producto ↔ categoría, que es de donde salen los conteos del árbol.
const cats = await db.select().from(schema.categories);
await db.insert(schema.productCategories).values(
  insertados.map((p) => ({ productId: p.id, categoryId: cats.find((c) => c.slug === p.categorySlug)!.id })),
);

after(async () => {
  await db.execute(sql`truncate table categories, product_categories restart identity cascade`);
  await pool.end();
});

test("celular samsung se entiende como Celulares + Samsung", async () => {
  const entendido = await understandCatalogQuery("celular samsung");
  assert.equal(entendido.category?.id, celulares.id);
  assert.equal(entendido.brand, "Samsung");
  assert.deepEqual(entendido.terms, []);

  const r = await listProducts({ terms: entendido.terms, categoryId: entendido.category?.id, brands: [entendido.brand!] });
  assert.deepEqual(r.items.map((p) => p.slug).sort(), ["galaxy-a15", "galaxy-a55"]);
});

test("lo que sobra se busca palabra por palabra dentro de lo detectado", async () => {
  const entendido = await understandCatalogQuery("celulares samsung a55");
  const r = await listProducts({ terms: entendido.terms, categoryId: entendido.category?.id, brands: [entendido.brand!] });
  assert.deepEqual(r.items.map((p) => p.slug), ["galaxy-a55"]);
});

test("las palabras se buscan todas, en cualquier orden y sin tildes", async () => {
  const r = await listProducts({ terms: ["a55", "samsung"] });
  assert.deepEqual(r.items.map((p) => p.slug).sort(), ["funda-a55", "galaxy-a55"]);
  assert.deepEqual((await listProducts({ terms: ["camaras"] })).items.map((p) => p.slug), ["camara"]);
});

test("el buscador del encabezado también busca palabra por palabra", async () => {
  const r = await searchProducts("samsung galaxy 128", 6);
  assert.deepEqual(r.map((p) => p.slug).sort(), ["galaxy-a15", "galaxy-a55"]);
  assert.deepEqual(await searchProducts("   ", 6), []);
});

test("el desplegable sugiere la categoría y sus marcas mientras se escribe", async () => {
  const celu = await searchShortcuts("celu");
  assert.deepEqual(
    celu.map((s) => [s.label, s.href, s.count]),
    [
      ["Celulares", "/categoria/celulares", 3],
      ["Celulares Samsung", "/categoria/celulares?marca=Samsung", 2],
      ["Celulares Apple", "/categoria/celulares?marca=Apple", 1],
      ["Accesorios P/ Celulares", "/categoria/accesorios-p-celulares", 2],
    ],
  );
  // Con la marca nombrada, solo esa marca.
  assert.deepEqual(
    (await searchShortcuts("celular samsung")).map((s) => s.label),
    ["Celulares", "Celulares Samsung", "Accesorios P/ Celulares"],
  );
  // Solo la marca: todo lo de esa marca.
  assert.deepEqual((await searchShortcuts("samsung"))[0], { label: "Todo Samsung", href: "/productos?marca=Samsung", count: 3 });
  assert.deepEqual(await searchShortcuts("iphone"), []);
});

test("el desplegable busca dentro de la categoría y marca que nombró", async () => {
  const r = await searchProducts("celular samsung", 6);
  assert.deepEqual(r.map((p) => p.slug).sort(), ["galaxy-a15", "galaxy-a55"]);
});
