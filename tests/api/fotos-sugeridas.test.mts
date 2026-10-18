/**
 * Fotos sugeridas del panel: "Usar" pone la foto como principal, suma las
 * vistas extra tildadas (las anteriores quedan después), "Descartar" la saca
 * de la lista, y la ruta solo acepta sugerencias de la lista.
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
  {
    slug: "camara",
    image: "https://fabricante.example/camara-frente.jpg",
    source: "https://fabricante.example/camara",
    confidence: "alta" as const,
    extras: ["https://fabricante.example/camara-atras.jpg", "https://fabricante.example/camara-costado.jpg"],
  },
  { slug: "no-existe", image: "https://fabricante.example/x.jpg", source: "https://fabricante.example/x", confidence: "alta" as const },
];

async function sembrar() {
  await db.insert(schema.products).values([
    { slug: "lente", name: "Lente", brand: "Test", categorySlug: "test", price: 1000, images: ["https://x.public.blob.vercel-storage.com/lente-chica.webp", "https://x.public.blob.vercel-storage.com/lente-2.webp"] },
    { slug: "parlante", name: "Parlante", brand: "Test", categorySlug: "test", price: 1000, images: [] },
    { slug: "camara", name: "Cámara", brand: "Test", categorySlug: "test", price: 1000, images: ["https://x.public.blob.vercel-storage.com/camara-chica.webp"] },
  ]);
}

const importados: string[] = [];
async function importarFalso(url: string) {
  importados.push(url);
  return { ok: true as const, url: "https://x.public.blob.vercel-storage.com/productos/nueva.webp" };
}
// Devuelve una URL distinta por foto, para ver el orden en que quedan.
async function importarPorNombre(url: string) {
  importados.push(url);
  if (url.includes("costado")) return { ok: false as const, error: "El sitio de la foto respondió 403." };
  return { ok: true as const, url: `https://x.public.blob.vercel-storage.com/productos/${url.split("/").pop()}.webp` };
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
    ["camara", "https://x.public.blob.vercel-storage.com/camara-chica.webp"],
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
  assert.deepEqual((await listPendingSuggestions(sugerencias)).map((p) => p.productSlug), ["parlante", "camara"]);

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
  assert.deepEqual((await listPendingSuggestions(sugerencias)).map((p) => p.productSlug), ["lente", "camara"]);
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
  assert.equal((await listPendingSuggestions(sugerencias)).length, 3);
});

test("las vistas extra tildadas se suman después de la principal; una que falla no frena el resto", async () => {
  await sembrar();
  const res = await decideSuggestion({
    slug: "camara",
    image: sugerencias[2].image,
    action: "usar",
    extras: [...sugerencias[2].extras!, "https://otro.example/no-esta-en-la-lista.jpg"],
    suggestions: sugerencias,
    importImage: importarPorNombre,
  });
  assert.deepEqual(res, { ok: true, slug: "camara", name: "Cámara", url: "https://x.public.blob.vercel-storage.com/productos/camara-frente.jpg.webp", added: 2, failedExtras: 1 });
  assert.ok(!importados.includes("https://otro.example/no-esta-en-la-lista.jpg"), "solo baja vistas de la sugerencia");
  const [camara] = await db.select().from(schema.products).where(eq(schema.products.slug, "camara"));
  assert.deepEqual(camara.images, [
    "https://x.public.blob.vercel-storage.com/productos/camara-frente.jpg.webp",
    "https://x.public.blob.vercel-storage.com/productos/camara-atras.jpg.webp",
    "https://x.public.blob.vercel-storage.com/camara-chica.webp",
  ]);
  assert.equal(camara.imageSrcSets.length, 3);
});

test("sin vistas tildadas solo se baja la principal", async () => {
  await sembrar();
  await decideSuggestion({ slug: "camara", image: sugerencias[2].image, action: "usar", extras: [], suggestions: sugerencias, importImage: importarPorNombre });
  assert.deepEqual(importados, [sugerencias[2].image]);
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
  assert.equal((await post({ slug: "lente", image: "x", action: "usar", extras: "no-es-lista" }, { cookie: await cookie() })).status, 400);
  assert.equal((await post({ slug: "lente", image: "x", action: "usar", extras: ["a", "b", "c", "d", "e"] }, { cookie: await cookie() })).status, 400);
  // La lista real (src/data/fotos-sugeridas.json) no tiene este producto.
  assert.equal((await post({ slug: "lente", image: "https://otro.example/x.jpg", action: "usar" }, { cookie: await cookie() })).status, 400);
});
