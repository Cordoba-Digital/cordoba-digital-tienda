/**
 * Precios y stock de una categoría para sus preguntas frecuentes
 * (`getCategoryPriceStats`, ver lib/category-seo.ts). Lo que importa: que sume
 * el subárbol y los productos que llegan por el puente N:N, y que un producto
 * sin precio no baje el "desde $…" a cero.
 *
 * Uso: npm run test:api (con DATABASE_URL a una base local migrada)
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { sql } from "drizzle-orm";

import { db, pool, resetDb, schema } from "./db.mts";

const { getCategoryPriceStats } = await import("../../src/lib/queries");

async function producto(slug: string, categorySlug: string, price: number, stock: number): Promise<number> {
  const [row] = await db
    .insert(schema.products)
    .values({ slug, name: `Producto ${slug}`, brand: "Test", categorySlug, price, stock })
    .returning({ id: schema.products.id });
  return row.id;
}

await resetDb();
await db.execute(sql`truncate table categories, product_categories restart identity cascade`);

const [celulares] = await db
  .insert(schema.categories)
  .values({ slug: "celulares", name: "Celulares" })
  .returning({ id: schema.categories.id });
const [xiaomi] = await db
  .insert(schema.categories)
  .values({ slug: "xiaomi", name: "Xiaomi", parentId: celulares.id })
  .returning({ id: schema.categories.id });

await producto("redmi", "xiaomi", 300000, 2); // subcategoría, por categoría principal
await producto("poco-agotado", "xiaomi", 900000, 0); // subcategoría, sin stock
await producto("sin-precio", "xiaomi", 0, 5); // no cuenta para el rango
const puente = await producto("moto", "ofertas", 450000, 1); // solo por el puente
await db.insert(schema.productCategories).values({ productId: puente, categoryId: celulares.id });
await producto("notebook", "notebooks", 50000, 3); // otra categoría: no suma

test.after(() => pool.end());

test("la categoría padre suma subcategorías y productos del puente", async () => {
  assert.deepEqual(await getCategoryPriceStats(celulares.id), {
    total: 4,
    inStock: 3,
    minPrice: 300000,
    maxPrice: 900000,
  });
});

test("la subcategoría solo cuenta lo suyo", async () => {
  assert.deepEqual(await getCategoryPriceStats(xiaomi.id), {
    total: 3,
    inStock: 2,
    minPrice: 300000,
    maxPrice: 900000,
  });
});

test("una categoría inexistente no cuenta el catálogo entero", async () => {
  assert.deepEqual(await getCategoryPriceStats(9999), { total: 0, inStock: 0, minPrice: null, maxPrice: null });
});
