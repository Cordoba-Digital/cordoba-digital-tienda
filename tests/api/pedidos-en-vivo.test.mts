/**
 * Huella de pedidos que usa el panel para actualizarse solo: pide sesión y
 * cambia cuando entra un pedido o cuando uno cambia de estado.
 *
 * Uso: npm run test:api (necesita Postgres local migrado en DATABASE_URL)
 */
import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";

process.env.ADMIN_PASSWORD = "clave-de-prueba";

const { db, pool, resetDb, schema } = await import("./db.mts");
const { createAdminSessionValue } = await import("../../src/lib/admin-auth");
const { applyOrderStatus } = await import("../../src/lib/order-status");
const { GET } = await import("../../src/app/api/admin/orders/novedades/route");

const URL_NOVEDADES = "http://localhost:3000/api/admin/orders/novedades";

async function firma(): Promise<string> {
  const value = await createAdminSessionValue("");
  assert.ok(value);
  const res = await GET(new Request(URL_NOVEDADES, { headers: { cookie: `admin_session=${encodeURIComponent(value)}` } }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(typeof body.firma, "string");
  return body.firma;
}

async function nuevoPedido(code: string): Promise<number> {
  const [row] = await db
    .insert(schema.orders)
    .values({
      code,
      status: "pendiente_pago",
      customerName: "Ana Pérez",
      email: "ana@example.com",
      phone: "351 555-1234",
      deliveryMethod: "pickup",
      paymentMethod: "transferencia",
      subtotal: 1000,
      total: 1000,
    })
    .returning({ id: schema.orders.id });
  return row.id;
}

beforeEach(resetDb);
after(() => pool.end());

test("sin sesión responde 401 y no muestra nada de los pedidos", async () => {
  const res = await GET(new Request(URL_NOVEDADES));
  assert.equal(res.status, 401);
  assert.equal((await res.json()).firma, undefined);
  const falsa = `admin_session=${Date.now() + 60_000}.${"a".repeat(64)}.s.`;
  assert.equal((await GET(new Request(URL_NOVEDADES, { headers: { cookie: falsa } }))).status, 401);
});

test("la huella cambia cuando entra un pedido y cuando cambia de estado, y no cambia sola", async () => {
  const vacia = await firma();
  assert.equal(await firma(), vacia);

  const id = await nuevoPedido("CD-VIVO1");
  const conPedido = await firma();
  assert.notEqual(conPedido, vacia);
  assert.equal(await firma(), conPedido);

  assert.equal(await applyOrderStatus(id, { from: "pendiente_pago", to: "pago_confirmado" }), true);
  assert.notEqual(await firma(), conPedido);
});
