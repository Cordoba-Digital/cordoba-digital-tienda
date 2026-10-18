/**
 * Revisión de fotos del panel: el filtro de la lista (sin foto, chicas,
 * marcadas, sin medir), la marca "Marcar foto" y la medición por tandas.
 *
 * Uso: npm run test:api (necesita Postgres local migrado en DATABASE_URL)
 */
import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";

process.env.ADMIN_PASSWORD = "clave-de-prueba";

const { db, pool, resetDb, schema } = await import("./db.mts");
const { createAdminSessionValue } = await import("../../src/lib/admin-auth");
const { GET } = await import("../../src/app/api/admin/products/route");
const { PATCH } = await import("../../src/app/api/admin/products/[slug]/route");
const fotos = await import("../../src/app/api/admin/fotos-revision/route");
const { clearPhotoFlagIfMainChanged, measurePhotosBatch, photoCheckStatus } = await import("../../src/lib/photo-checks");

const BASE = "http://localhost:3000";
const cookie = async () => `admin_session=${encodeURIComponent((await createAdminSessionValue("")) ?? "")}`;

async function lista(query: string): Promise<string[]> {
  const res = await GET(new Request(`${BASE}/api/admin/products?${query}`, { headers: { cookie: await cookie() } }));
  const data = (await res.json()) as { items: { slug: string }[] };
  return data.items.map((p) => p.slug).sort();
}

async function sembrar() {
  const rows = await db
    .insert(schema.products)
    .values([
      { slug: "sin-foto", name: "Sin foto", brand: "Test", categorySlug: "test", price: 1000, images: [] },
      { slug: "chica", name: "Chica", brand: "Test", categorySlug: "test", price: 1000, images: ["https://x.public.blob.vercel-storage.com/chica.webp"] },
      { slug: "grande", name: "Grande", brand: "Test", categorySlug: "test", price: 1000, images: ["https://x.public.blob.vercel-storage.com/grande.webp"] },
      { slug: "nueva", name: "Nueva", brand: "Test", categorySlug: "test", price: 1000, images: ["https://x.public.blob.vercel-storage.com/nueva.webp"] },
    ])
    .returning({ id: schema.products.id, slug: schema.products.slug });
  return Object.fromEntries(rows.map((r) => [r.slug, r.id]));
}

const tamanos: Record<string, { width: number; height: number }> = {
  "https://x.public.blob.vercel-storage.com/chica.webp": { width: 640, height: 480 },
  "https://x.public.blob.vercel-storage.com/grande.webp": { width: 1600, height: 1600 },
};
async function medirFalso(url: string) {
  const size = tamanos[url];
  if (!size) throw new Error("HTTP 404");
  return size;
}

beforeEach(resetDb);
after(() => pool.end());

test("mide por tandas, guarda el tamaño y saltea las que fallan", async () => {
  await sembrar();
  const tanda = await measurePhotosBatch({ timeBudgetMs: 10_000, measure: medirFalso });
  assert.equal(tanda.measured, 2);
  assert.equal(tanda.failed, 1);
  assert.match(tanda.errors[0], /^Nueva: HTTP 404/);
  assert.equal(tanda.remaining, 0, "la que falló no cuenta como pendiente en esta corrida");

  const otra = await measurePhotosBatch({ timeBudgetMs: 10_000, measure: medirFalso, skip: tanda.failedProductIds });
  assert.equal(otra.products, 0, "lo ya medido no se vuelve a medir");

  assert.deepEqual(await photoCheckStatus(), { withPhoto: 3, noPhoto: 1, small: 1, flagged: 0, unmeasured: 1 });
});

test("la lista filtra sin foto, chicas y sin medir", async () => {
  await sembrar();
  await measurePhotosBatch({ timeBudgetMs: 10_000, measure: medirFalso });
  assert.deepEqual(await lista("fotos=sin"), ["sin-foto"]);
  assert.deepEqual(await lista("fotos=chicas"), ["chica"]);
  assert.deepEqual(await lista("fotos=sin-medir"), ["nueva"]);
  assert.deepEqual(await lista("fotos=cualquiera"), ["chica", "grande", "nueva", "sin-foto"]);
});

test("si cambia la foto principal, la medición vieja deja de contar", async () => {
  const ids = await sembrar();
  await measurePhotosBatch({ timeBudgetMs: 10_000, measure: medirFalso });
  await db
    .update(schema.products)
    .set({ images: ["https://x.public.blob.vercel-storage.com/reemplazo.webp"] })
    .where((await import("drizzle-orm")).eq(schema.products.id, ids.chica));
  assert.deepEqual(await lista("fotos=chicas"), []);
  assert.deepEqual(await lista("fotos=sin-medir"), ["chica", "nueva"]);
});

test("Marcar foto desde la lista: se guarda, filtra y se saca al cambiar la foto principal", async () => {
  const ids = await sembrar();
  const marcar = async (slug: string, photoFlagged: boolean) =>
    PATCH(
      new Request(`${BASE}/api/admin/products/${slug}`, {
        method: "PATCH",
        headers: { cookie: await cookie(), "Content-Type": "application/json" },
        body: JSON.stringify({ photoFlagged }),
      }),
      { params: Promise.resolve({ slug }) },
    );

  assert.equal((await marcar("grande", true)).status, 200);
  assert.deepEqual(await lista("fotos=marcadas"), ["grande"]);

  const res = await GET(new Request(`${BASE}/api/admin/products?fotos=marcadas`, { headers: { cookie: await cookie() } }));
  const [fila] = ((await res.json()) as { items: { photoFlagged: boolean; price: number }[] }).items;
  assert.equal(fila.photoFlagged, true);
  assert.equal(fila.price, 1000, "marcar no toca el resto de la ficha");

  await clearPhotoFlagIfMainChanged(ids.grande, "https://x.public.blob.vercel-storage.com/grande.webp", "https://x.public.blob.vercel-storage.com/grande.webp");
  assert.deepEqual(await lista("fotos=marcadas"), ["grande"], "misma foto principal: la marca sigue");
  await clearPhotoFlagIfMainChanged(ids.grande, "https://x.public.blob.vercel-storage.com/grande.webp", "https://x.public.blob.vercel-storage.com/otra.webp");
  assert.deepEqual(await lista("fotos=marcadas"), []);

  assert.equal((await marcar("grande", true)).status, 200);
  assert.equal((await marcar("grande", false)).status, 200);
  assert.deepEqual(await lista("fotos=marcadas"), []);
});

test("la ruta de medición pide sesión", async () => {
  assert.equal((await fotos.GET(new Request(`${BASE}/api/admin/fotos-revision`))).status, 401);
  assert.equal((await fotos.POST(new Request(`${BASE}/api/admin/fotos-revision`, { method: "POST", body: "{}" }))).status, 401);
  const res = await fotos.GET(new Request(`${BASE}/api/admin/fotos-revision`, { headers: { cookie: await cookie() } }));
  assert.equal(res.status, 200);
  assert.equal(((await res.json()) as { noPhoto: number }).noPhoto, 0);
});
