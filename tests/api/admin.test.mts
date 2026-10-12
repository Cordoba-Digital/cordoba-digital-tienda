/**
 * Permisos del panel: el middleware frena CSRF y pedidos sin sesión, y las
 * rutas vuelven a chequear la sesión (y quién es dueño) contra la base.
 *
 * Uso: npm run test:api (necesita Postgres local migrado en DATABASE_URL)
 */
import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";

process.env.ADMIN_PASSWORD = "clave-de-prueba";
process.env.ADMIN_EMAILS = "duenio@example.com";

const { db, pool, resetDb, schema } = await import("./db.mts");
const { createAdminSessionValue } = await import("../../src/lib/admin-auth");
const { addAdminAccess } = await import("../../src/lib/admin-access");
const { DELETE, GET } = await import("../../src/app/api/admin/orders/route");
const { middleware } = await import("../../middleware");

const BASE = "http://localhost:3000";

async function cookie(email = ""): Promise<string> {
  const value = await createAdminSessionValue(email);
  assert.ok(value);
  return `admin_session=${encodeURIComponent(value)}`;
}

function borrar(cookieHeader: string, body: unknown = { confirm: "BORRAR" }): Request {
  return new Request(`${BASE}/api/admin/orders`, {
    method: "DELETE",
    headers: { "content-type": "application/json", cookie: cookieHeader, origin: BASE },
    body: JSON.stringify(body),
  });
}

beforeEach(resetDb);
after(() => pool.end());

test("GET de pedidos sin cookie o con cookie inventada responde 401", async () => {
  assert.equal((await GET(new Request(`${BASE}/api/admin/orders`))).status, 401);
  const falsa = `admin_session=${Date.now() + 60_000}.${"a".repeat(64)}.s.`;
  assert.equal((await GET(new Request(`${BASE}/api/admin/orders`, { headers: { cookie: falsa } }))).status, 401);
});

test("GET de pedidos con sesión de contraseña responde la lista", async () => {
  const res = await GET(new Request(`${BASE}/api/admin/orders`, { headers: { cookie: await cookie() } }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
});

test("un email que no es admin no entra aunque la firma sea válida", async () => {
  const res = await GET(new Request(`${BASE}/api/admin/orders`, { headers: { cookie: await cookie("intruso@example.com") } }));
  assert.equal(res.status, 401);
});

test("un admin agregado desde Accesos entra pero no puede borrar todos los pedidos", async () => {
  await addAdminAccess("empleado@example.com", "duenio@example.com");
  const sesion = await cookie("empleado@example.com");
  assert.equal((await GET(new Request(`${BASE}/api/admin/orders`, { headers: { cookie: sesion } }))).status, 200);
  assert.equal((await DELETE(borrar(sesion))).status, 403);
});

test("el dueño borra todos los pedidos solo con la confirmación", async () => {
  await db.insert(schema.orders).values({
    code: "CD-TEST1",
    status: "pendiente_pago",
    customerName: "Ana Pérez",
    email: "ana@example.com",
    phone: "351 555-1234",
    deliveryMethod: "pickup",
    paymentMethod: "transferencia",
    subtotal: 1000,
    total: 1000,
  });
  const sesion = await cookie("duenio@example.com");
  assert.equal((await DELETE(borrar(sesion, {}))).status, 400);
  const res = await DELETE(borrar(sesion));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).deleted, 1);
  assert.equal((await db.select().from(schema.orders)).length, 0);
});

test("middleware: escritura en /api/admin desde otro origen responde 403", async () => {
  const res = await middleware(
    new Request(`${BASE}/api/admin/orders`, {
      method: "DELETE",
      headers: { cookie: await cookie(), origin: "https://otro-sitio.example" },
    }),
  );
  assert.equal(res.status, 403);
});

test("middleware: escritura sin Origin ni Referer responde 403", async () => {
  const res = await middleware(new Request(`${BASE}/api/admin/orders`, { method: "POST", headers: { cookie: await cookie() } }));
  assert.equal(res.status, 403);
});

test("middleware: /api/admin sin sesión responde 401 y /admin redirige al login", async () => {
  assert.equal((await middleware(new Request(`${BASE}/api/admin/orders`))).status, 401);
  const pagina = await middleware(new Request(`${BASE}/admin/pedidos`));
  assert.equal(pagina.status, 307);
  assert.match(pagina.headers.get("location") ?? "", /\/admin\/login\?next=%2Fadmin%2Fpedidos$/);
});

test("middleware: con sesión deja pasar y agrega los headers del panel", async () => {
  const res = await middleware(new Request(`${BASE}/admin/pedidos`, { headers: { cookie: await cookie() } }));
  assert.equal(res.headers.get("x-middleware-next"), "1");
  assert.equal(res.headers.get("x-frame-options"), "DENY");
  assert.equal(res.headers.get("cache-control"), "no-store");
});
