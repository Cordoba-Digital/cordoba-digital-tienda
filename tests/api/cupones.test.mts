/**
 * Cupones con vencimiento y tope de usos: el checkout cuenta el uso en la
 * misma transacción del pedido, un pedido cancelado lo devuelve, y solo un
 * admin los crea o edita desde el panel.
 *
 * Uso: npm run test:api (necesita Postgres local migrado en DATABASE_URL)
 */
import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";

import { eq } from "drizzle-orm";

process.env.ADMIN_PASSWORD = "clave-de-prueba";
process.env.ADMIN_EMAILS = "duenio@example.com";
delete process.env.MP_ACCESS_TOKEN;

const { comprador, db, domicilio, pool, post, resetDb, schema, seedProduct } = await import("./db.mts");
const { POST: checkoutPOST } = await import("../../src/app/api/checkout/route");
const { POST: cuponPOST } = await import("../../src/app/api/coupon/route");
const { GET: listar, POST: crear } = await import("../../src/app/api/admin/coupons/route");
const { PATCH: editar } = await import("../../src/app/api/admin/coupons/[code]/route");
const { applyOrderStatus } = await import("../../src/lib/order-status");
const { createAdminSessionValue } = await import("../../src/lib/admin-auth");

const BASE = "http://localhost:3000";

async function checkout(couponCode: string) {
  const res = await checkoutPOST(
    post("/api/checkout", {
      customer: comprador,
      delivery: domicilio,
      payment: { method: "transferencia" },
      items: [{ slug: "note", quantity: 1 }],
      couponCode,
    }),
  );
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

async function cupon(code: string) {
  const [row] = await db.select().from(schema.coupons).where(eq(schema.coupons.code, code));
  return row;
}

async function descuento(code: string) {
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.code, code));
  return order.discount;
}

async function sesion(): Promise<string> {
  return `admin_session=${encodeURIComponent((await createAdminSessionValue("duenio@example.com"))!)}`;
}

function pedidoAdmin(path: string, method: string, body: unknown, cookie: string): Request {
  return new Request(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", cookie, origin: BASE },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  await resetDb();
  await seedProduct("note", 1_000_000, 10);
});
after(() => pool.end());

test("un cupón vencido no descuenta y el carrito lo rechaza", async () => {
  await db.insert(schema.coupons).values({
    code: "VIEJO",
    kind: "percent",
    value: 10,
    expiresAt: new Date(Date.now() - 60_000),
  });
  const res = await checkout("VIEJO");
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(await descuento(res.body.code as string), 0);
  assert.equal((await cupon("VIEJO")).usedCount, 0);

  const carrito = await cuponPOST(post("/api/coupon", { code: "viejo", subtotal: 1_000_000 }));
  assert.equal(carrito.status, 404);
});

test("el tope de usos se respeta y cada pedido suma un uso", async () => {
  await db.insert(schema.coupons).values({ code: "UNO", kind: "fixed", value: 50_000, maxUses: 1 });
  const primero = await checkout("UNO");
  assert.equal(await descuento(primero.body.code as string), 50_000);
  assert.equal((await cupon("UNO")).usedCount, 1);

  const segundo = await checkout("UNO");
  assert.equal(segundo.status, 200);
  assert.equal(await descuento(segundo.body.code as string), 0);
  assert.equal((await cupon("UNO")).usedCount, 1);
});

test("dos pedidos a la vez por el último uso: solo uno se lleva el descuento", async () => {
  await db.insert(schema.coupons).values({ code: "ULTIMO", kind: "fixed", value: 50_000, maxUses: 1 });
  const resultados = await Promise.all([checkout("ULTIMO"), checkout("ULTIMO")]);
  const conDescuento = [];
  for (const r of resultados) {
    if (r.status === 409) {
      assert.match(r.body.error as string, /se acaba de agotar/);
      continue;
    }
    assert.equal(r.status, 200, JSON.stringify(r.body));
    if ((await descuento(r.body.code as string)) > 0) conDescuento.push(r.body.code);
  }
  assert.equal(conDescuento.length, 1);
  assert.equal((await cupon("ULTIMO")).usedCount, 1);
});

test("cancelar el pedido devuelve el uso y reactivarlo lo vuelve a contar", async () => {
  await db.insert(schema.coupons).values({ code: "UNO", kind: "percent", value: 5, maxUses: 1 });
  const res = await checkout("UNO");
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.code, res.body.code as string));

  assert.ok(await applyOrderStatus(order.id, { from: "pendiente_pago", to: "cancelado" }));
  assert.equal((await cupon("UNO")).usedCount, 0);

  assert.ok(await applyOrderStatus(order.id, { from: "cancelado", to: "pendiente_pago" }));
  assert.equal((await cupon("UNO")).usedCount, 1);
});

test("el panel pide sesión para listar y crear cupones", async () => {
  assert.equal((await listar(new Request(`${BASE}/api/admin/coupons`))).status, 401);
  const res = await crear(pedidoAdmin("/api/admin/coupons", "POST", { code: "X1X", kind: "percent", value: 10 }, ""));
  assert.equal(res.status, 401);
  assert.equal((await db.select().from(schema.coupons)).length, 0);
});

test("un admin crea un cupón con vencimiento y tope, y no puede repetir el código", async () => {
  const cookie = await sesion();
  const res = await crear(
    pedidoAdmin(
      "/api/admin/coupons",
      "POST",
      { code: " hotsale ", kind: "percent", value: "15", minSubtotal: "100000", expiresOn: "2099-05-31", maxUses: "50" },
      cookie,
    ),
  );
  assert.equal(res.status, 200, await res.clone().text());
  const guardado = await cupon("HOTSALE");
  assert.equal(guardado.value, 15);
  assert.equal(guardado.minSubtotal, 100_000);
  assert.equal(guardado.maxUses, 50);
  // Último instante del 31/5 en Córdoba (UTC−3).
  assert.equal(guardado.expiresAt?.toISOString(), "2099-06-01T02:59:59.999Z");

  const repetido = await crear(pedidoAdmin("/api/admin/coupons", "POST", { code: "HOTSALE", kind: "fixed", value: 1000 }, cookie));
  assert.equal(repetido.status, 409);

  const lista = (await (await listar(new Request(`${BASE}/api/admin/coupons`, { headers: { cookie } }))).json()) as {
    coupons: { code: string; expiresOn: string; problem: string | null }[];
  };
  assert.deepEqual(lista.coupons.map((c) => [c.code, c.expiresOn, c.problem]), [["HOTSALE", "2099-05-31", null]]);
});

test("el panel rechaza datos inválidos", async () => {
  const cookie = await sesion();
  const casos = [
    { code: "con espacio", kind: "percent", value: 10 },
    { code: "MUCHO", kind: "percent", value: 150 },
    { code: "CERO", kind: "fixed", value: 0 },
    { code: "FECHA", kind: "percent", value: 10, expiresOn: "2026-02-31" },
    { code: "TOPE", kind: "percent", value: 10, maxUses: "1.5" },
  ];
  for (const body of casos) {
    const res = await crear(pedidoAdmin("/api/admin/coupons", "POST", body, cookie));
    assert.equal(res.status, 400, JSON.stringify(body));
  }
  assert.equal((await db.select().from(schema.coupons)).length, 0);
});

test("editar pausa el cupón, cambia el tope y no toca el código ni los usos", async () => {
  await db.insert(schema.coupons).values({ code: "EDITAME", kind: "percent", value: 10, usedCount: 3 });
  const cookie = await sesion();
  const res = await editar(
    pedidoAdmin("/api/admin/coupons/EDITAME", "PATCH", { code: "OTRO", kind: "percent", value: 20, maxUses: 3, active: false }, cookie),
    { params: Promise.resolve({ code: "EDITAME" }) },
  );
  assert.equal(res.status, 200, await res.clone().text());
  const row = await cupon("EDITAME");
  assert.equal(row.value, 20);
  assert.equal(row.maxUses, 3);
  assert.equal(row.active, false);
  assert.equal(row.usedCount, 3);
  assert.equal(await cupon("OTRO"), undefined);

  const falta = await editar(pedidoAdmin("/api/admin/coupons/NOEXISTE", "PATCH", { kind: "percent", value: 5 }, cookie), {
    params: Promise.resolve({ code: "NOEXISTE" }),
  });
  assert.equal(falta.status, 404);
});
