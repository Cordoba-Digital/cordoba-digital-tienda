/**
 * Recomendaciones de la ficha: misma categoría, primero con stock, después la
 * misma marca y el precio más parecido. Con una marca de relleno ("General")
 * no se prioriza la marca, y la consulta no tiene que fallar: un `0` suelto en
 * el ORDER BY Postgres lo lee como "columna 0" y tiraba abajo la ficha entera.
 *
 * Uso: npm run test:api (necesita Postgres local migrado en DATABASE_URL)
 */
import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";

const { db, pool, resetDb, schema } = await import("./db.mts");
const { getRelatedProducts } = await import("../../src/lib/queries");

beforeEach(resetDb);
after(() => pool.end());

const base = { categorySlug: "accesorios", stock: 5 };

test("con marca de relleno ordena por stock y precio, sin fallar", async () => {
  await db.insert(schema.products).values([
    { ...base, slug: "lejos", name: "Lejos", brand: "General", price: 500_000 },
    { ...base, slug: "cerca", name: "Cerca", brand: "Otra", price: 110_000 },
    { ...base, slug: "sin-stock", name: "Sin stock", brand: "General", price: 100_000, stock: 0 },
  ]);
  const related = await getRelatedProducts({ slug: "este", categorySlug: "accesorios", brand: "General", price: 100_000 });
  assert.deepEqual(related.map((p) => p.slug), ["cerca", "lejos", "sin-stock"]);
});

test("con marca real prioriza la misma marca antes que el precio", async () => {
  await db.insert(schema.products).values([
    { ...base, slug: "otra-marca", name: "Otra marca", brand: "Xiaomi", price: 100_000 },
    { ...base, slug: "misma-marca", name: "Misma marca", brand: "Samsung", price: 300_000 },
  ]);
  const related = await getRelatedProducts({ slug: "este", categorySlug: "accesorios", brand: "Samsung", price: 100_000 });
  assert.deepEqual(related.map((p) => p.slug), ["misma-marca", "otra-marca"]);
});
