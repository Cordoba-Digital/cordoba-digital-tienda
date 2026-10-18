/**
 * Lista de productos del panel: se carga de a tandas al scrollear, así que
 * las páginas no pueden repetir ni saltear productos y respetan los filtros.
 *
 * Uso: npm run test:api (necesita Postgres local migrado en DATABASE_URL)
 */
import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";

process.env.ADMIN_PASSWORD = "clave-de-prueba";

const { db, pool, resetDb, schema } = await import("./db.mts");
const { createAdminSessionValue } = await import("../../src/lib/admin-auth");
const { GET } = await import("../../src/app/api/admin/products/route");

const BASE = "http://localhost:3000";

async function pedir(query: string, conSesion = true): Promise<Response> {
  const value = conSesion ? await createAdminSessionValue("") : "";
  return GET(
    new Request(`${BASE}/api/admin/products?${query}`, {
      headers: value ? { cookie: `admin_session=${encodeURIComponent(value)}` } : {},
    }),
  );
}

beforeEach(resetDb);
after(() => pool.end());

test("sin sesión responde 401", async () => {
  assert.equal((await pedir("page=2", false)).status, 401);
});

test("las tandas cubren todos los productos sin repetir, aunque se hayan cargado en el mismo instante", async () => {
  const mismoMomento = new Date("2026-01-01T12:00:00Z");
  await db.insert(schema.products).values(
    Array.from({ length: 7 }, (_, i) => ({
      slug: `prod-${i}`,
      name: `Producto ${i}`,
      brand: "Test",
      categorySlug: "celulares",
      price: 1000 + i,
      stock: i % 2,
      createdAt: mismoMomento,
    })),
  );
  const vistos: string[] = [];
  for (const page of [1, 2, 3]) {
    const data = (await (await pedir(`page=${page}&perPage=3`)).json()) as { items: { slug: string }[]; total: number };
    assert.equal(data.total, 7);
    vistos.push(...data.items.map((p) => p.slug));
  }
  assert.equal(vistos.length, 7);
  assert.equal(new Set(vistos).size, 7);
});

test("respeta el filtro de stock y el orden que usa la página", async () => {
  await db.insert(schema.products).values([
    { slug: "sin", name: "Sin stock", brand: "Test", categorySlug: "celulares", price: 1000, stock: 0 },
    { slug: "poco", name: "Poco stock", brand: "Test", categorySlug: "celulares", price: 1000, stock: 2 },
    { slug: "mucho", name: "Mucho stock", brand: "Test", categorySlug: "celulares", price: 1000, stock: 9 },
  ]);
  const data = (await (await pedir("stock=con&orden=stock-desc&page=1&perPage=10")).json()) as { items: { slug: string }[] };
  assert.deepEqual(data.items.map((p) => p.slug), ["mucho", "poco"]);
});
