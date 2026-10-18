/**
 * Panel → Inicio: guardar el orden de la home pide sesión (y el middleware
 * frena el CSRF), y lo que se guarda pasa por la validación de bloques.
 *
 * Uso: npm run test:api (necesita Postgres local migrado en DATABASE_URL)
 */
import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";

process.env.ADMIN_PASSWORD = "clave-de-prueba";
process.env.ADMIN_EMAILS = "duenio@example.com";

const { db, pool, resetDb, schema } = await import("./db.mts");
const { createAdminSessionValue } = await import("../../src/lib/admin-auth");
const { getHomeLayout, getTopBarVisible } = await import("../../src/lib/home-layout-server");
const { defaultHomeLayout, visibleHomeBlocks } = await import("../../src/lib/home-layout");
const { PUT } = await import("../../src/app/api/admin/home/route");
const { middleware } = await import("../../middleware");

const BASE = "http://localhost:3000";

async function cookie(email = ""): Promise<string> {
  const value = await createAdminSessionValue(email);
  assert.ok(value);
  return `admin_session=${encodeURIComponent(value)}`;
}

function guardar(blocks: unknown, headers: Record<string, string> = {}, extra: Record<string, unknown> = {}): Request {
  return new Request(`${BASE}/api/admin/home`, {
    method: "PUT",
    headers: { "content-type": "application/json", origin: BASE, ...headers },
    body: JSON.stringify({ blocks, ...extra }),
  });
}

beforeEach(resetDb);
after(() => pool.end());

test("sin sesión no se guarda nada", async () => {
  const res = await PUT(guardar([{ id: "ofertas", visible: false }]));
  assert.equal(res.status, 401);
  assert.equal((await db.select().from(schema.storeSettings)).length, 0);
});

test("un PUT desde otro sitio lo frena el middleware", async () => {
  const req = guardar([], { cookie: await cookie(), origin: "https://otro-sitio.com" });
  const res = await middleware(req as never);
  assert.equal(res.status, 403);
});

test("sin bloques responde 400", async () => {
  const res = await PUT(new Request(`${BASE}/api/admin/home`, {
    method: "PUT",
    headers: { "content-type": "application/json", cookie: await cookie() },
    body: JSON.stringify({}),
  }));
  assert.equal(res.status, 400);
});

test("guarda el orden validado, la home lo lee y queda en la actividad", async () => {
  assert.deepEqual(await getHomeLayout(), defaultHomeLayout());

  const res = await PUT(
    guardar(
      [
        { id: "ofertas", visible: true },
        { id: "inventado", visible: true },
        { id: "local", visible: false },
      ],
      { cookie: await cookie("duenio@example.com") },
    ),
  );
  assert.equal(res.status, 200);
  const body = (await res.json()) as { ok: boolean; blocks: { id: string }[] };
  assert.equal(body.ok, true);
  // Lo que no vino en la lista se suma en su lugar del orden recomendado.
  assert.deepEqual(body.blocks.slice(0, 3).map((b) => b.id), ["portada", "vistos", "categorias"]);

  const visibles = visibleHomeBlocks(await getHomeLayout());
  assert.deepEqual(visibles.slice(0, 6), ["portada", "vistos", "categorias", "ofertas", "vitrinas", "mas-vendidos"]);
  assert.ok(!visibles.includes("local"));
  assert.ok(!visibles.includes("inventado" as never));

  const [row] = await db.select().from(schema.storeSettings);
  assert.equal(row.updatedBy, "duenio@example.com");
  const audit = await db.select().from(schema.adminAudit);
  assert.equal(audit.at(-1)?.action, "inicio_editado");
  assert.match(audit.at(-1)?.summary ?? "", /Ocultos: .*El local/);
});

test("la barra de avisos se apaga y se prende desde el mismo guardado, y queda en la actividad", async () => {
  assert.equal(await getTopBarVisible(), true);
  const admin = { cookie: await cookie("duenio@example.com") };

  let res = await PUT(guardar(defaultHomeLayout(), admin, { topBar: false }));
  assert.equal(res.status, 200);
  assert.equal(((await res.json()) as { topBar: boolean }).topBar, false);
  assert.equal(await getTopBarVisible(), false);
  assert.match((await db.select().from(schema.adminAudit)).at(-1)?.summary ?? "", /Barra de avisos: oculta/);

  // Sin `topBar` en el pedido (un panel viejo abierto) no se toca.
  res = await PUT(guardar(defaultHomeLayout(), admin));
  assert.equal(((await res.json()) as { topBar: boolean }).topBar, false);
  assert.equal(await getTopBarVisible(), false);

  // Un valor que no es booleano tampoco la cambia.
  await PUT(guardar(defaultHomeLayout(), admin, { topBar: "no" }));
  assert.equal(await getTopBarVisible(), false);

  await PUT(guardar(defaultHomeLayout(), admin, { topBar: true }));
  assert.equal(await getTopBarVisible(), true);
});
