/**
 * Fotos sugeridas del panel: "Usar esta foto" la pone como principal (la
 * anterior queda segunda), "Descartar" la saca de la lista, y la ruta solo
 * acepta sugerencias de la lista.
 *
 * Uso: npm run test:api (necesita Postgres local migrado en DATABASE_URL)
 */
import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";

process.env.ADMIN_PASSWORD = "clave-de-prueba";

const { db, pool, resetDb, schema } = await import("./db.mts");
const { eq } = await import("drizzle-orm");
const { createAdminSessionValue } = await import("../../src/lib/admin-auth");
const { decideSuggestion, listPendingSuggestions } = await import("../../src/lib/photo-suggestions");
const ruta = await import("../../src/app/api/admin/fotos-sugeridas/route");

const BASE = "http://localhost:3000";
const cookie = async () => `admin_session=${encodeURIComponent((await createAdminSessionValue("")) ?? "")}`;

const sugerencias = [
  { slug: "lente", image: "https://fabricante.example/lente-1600.jpg", source: "https://fabricante.example/lente", confidence: "alta" as const },
  { slug: "parlante", image: "https://fabricante.example/parlante.png", source: "https://fabricante.example/parlante", confidence: "media" as const, note: "color dudoso" },
  { slug: "no-existe", image: "https://fabricante.example/x.jpg", source: "https://fabricante.example/x", confidence: "alta" as const },
];

async function sembrar() {
  await db.insert(schema.products).values([
    { slug: "lente", name: "Lente", brand: "Test", categorySlug: "test", price: 1000, images: ["https://x.public.blob.vercel-storage.com/lente-chica.webp", "https://x.public.blob.vercel-storage.com/lente-2.webp"] },
    { slug: "parlante", name: "Parlante", brand: "Test", categorySlug: "test", price: 1000, images: [] },
  ]);
}

const importados: string[] = [];
async function importarFalso(url: string) {
  importados.push(url);
  return { ok: true as const, url: "https://x.public.blob.vercel-storage.com/productos/nueva.webp" };
}

beforeEach(async () => {
  await resetDb();
  importados.length = 0;
});
after(() => pool.end());

test("lista solo las sugerencias de productos que existen", async () => {
  await sembrar();
  const pendientes = await listPendingSuggestions(sugerencias);
  assert.deepEqual(pendientes.map((p) => [p.productSlug, p.currentImage]), [
    ["lente", "https://x.public.blob.vercel-storage.com/lente-chica.webp"],
    ["parlante", ""],
  ]);
});

test("usar la foto la pone primera, deja la anterior segunda y no vuelve a aparecer", async () => {
  await sembrar();
  const res = await decideSuggestion({ slug: "lente", image: sugerencias[0].image, action: "usar", suggestions: sugerencias, importImage: importarFalso });
  assert.equal(res.ok, true);
  assert.deepEqual(importados, [sugerencias[0].image]);
  const [lente] = await db.select().from(schema.products).where(eq(schema.products.slug, "lente"));
  assert.deepEqual(lente.images, [
    "https://x.public.blob.vercel-storage.com/productos/nueva.webp",
    "https://x.public.blob.vercel-storage.com/lente-chica.webp",
    "https://x.public.blob.vercel-storage.com/lente-2.webp",
  ]);
  assert.equal(lente.imageSrcSets.length, 3);
  assert.deepEqual((await listPendingSuggestions(sugerencias)).map((p) => p.productSlug), ["parlante"]);

  const otra = await decideSuggestion({ slug: "lente", image: sugerencias[0].image, action: "usar", suggestions: sugerencias, importImage: importarFalso });
  assert.equal(otra.ok, false, "la misma sugerencia no se aplica dos veces");
});

test("descartar no toca el producto", async () => {
  await sembrar();
  const res = await decideSuggestion({ slug: "parlante", image: sugerencias[1].image, action: "descartar", suggestions: sugerencias, importImage: importarFalso });
  assert.equal(res.ok, true);
  assert.deepEqual(importados, []);
  const [parlante] = await db.select().from(schema.products).where(eq(schema.products.slug, "parlante"));
  assert.deepEqual(parlante.images, []);
  assert.deepEqual((await listPendingSuggestions(sugerencias)).map((p) => p.productSlug), ["lente"]);
});

test("si la descarga falla, el producto queda igual y la sugerencia sigue pendiente", async () => {
  await sembrar();
  const res = await decideSuggestion({
    slug: "lente",
    image: sugerencias[0].image,
    action: "usar",
    suggestions: sugerencias,
    importImage: async () => ({ ok: false, error: "El sitio de la foto respondió 403." }),
  });
  assert.deepEqual(res, { ok: false, error: "El sitio de la foto respondió 403." });
  assert.equal((await listPendingSuggestions(sugerencias)).length, 2);
});

test("no acepta una foto que no está en la lista", async () => {
  await sembrar();
  const res = await decideSuggestion({ slug: "lente", image: "https://otro.example/cualquiera.jpg", action: "usar", suggestions: sugerencias, importImage: importarFalso });
  assert.equal(res.ok, false);
  assert.deepEqual(importados, []);
});

test("la ruta pide sesión y valida el pedido", async () => {
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    ruta.POST(new Request(`${BASE}/api/admin/fotos-sugeridas`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) }));
  assert.equal((await post({ slug: "lente", image: "x", action: "usar" })).status, 401);
  assert.equal((await post({ slug: "lente", action: "borrar" }, { cookie: await cookie() })).status, 400);
  // La lista real (src/data/fotos-sugeridas.json) no tiene este producto.
  assert.equal((await post({ slug: "lente", image: "https://otro.example/x.jpg", action: "usar" }, { cookie: await cookie() })).status, 400);
});
