/**
 * Productos parecidos para el alta ("Usar como base"): solo con sesión del
 * panel, y encuentra el mismo modelo aunque cambie la memoria.
 *
 * Uso: npm run test:api (necesita Postgres local migrado en DATABASE_URL)
 */
import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";

process.env.ADMIN_PASSWORD = "clave-de-prueba";

const { db, pool, resetDb, schema } = await import("./db.mts");
const { createAdminSessionValue } = await import("../../src/lib/admin-auth");
const { GET } = await import("../../src/app/api/admin/products/parecidos/route");

const BASE = "http://localhost:3000";

function pedir(nombre: string, cookie = ""): Request {
  return new Request(`${BASE}/api/admin/products/parecidos?nombre=${encodeURIComponent(nombre)}`, {
    headers: cookie ? { cookie } : {},
  });
}

beforeEach(resetDb);
after(() => pool.end());

test("sin sesión responde 401", async () => {
  assert.equal((await GET(pedir("Samsung Galaxy A56 5G 512 GB"))).status, 401);
});

test("encuentra el mismo modelo con otra memoria y trae su ficha", async () => {
  await db.insert(schema.products).values([
    {
      slug: "galaxy-a56-256",
      name: "Samsung Galaxy A56 5G 256 GB 8 GB RAM",
      brand: "Samsung",
      categorySlug: "celulares",
      price: 900_000,
      shortDescription: "Pantalla de 6,7 pulgadas.",
      specs: [{ label: "Batería", value: "5000 mAh" }],
    },
    { slug: "galaxy-a16", name: "Samsung Galaxy A16 128 GB", brand: "Samsung", categorySlug: "celulares", price: 300_000 },
    { slug: "moto-g35", name: "Motorola Moto G35 5G 256 GB", brand: "Motorola", categorySlug: "celulares", price: 400_000 },
  ]);
  const value = await createAdminSessionValue("");
  assert.ok(value);
  const res = await GET(pedir("samsung galaxy a56 5g 512gb 12gb", `admin_session=${encodeURIComponent(value)}`));
  assert.equal(res.status, 200);
  const data = (await res.json()) as { items: { slug: string; shortDescription: string; specs: unknown[] }[] };
  assert.deepEqual(data.items.map((p) => p.slug), ["galaxy-a56-256"]);
  assert.equal(data.items[0].shortDescription, "Pantalla de 6,7 pulgadas.");
  assert.equal(data.items[0].specs.length, 1);
});
