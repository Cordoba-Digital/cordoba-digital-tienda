/**
 * Devoluciones de producto desde el panel: solo de pedidos que salieron,
 * nunca más unidades que las compradas, y el stock vuelve a la tienda.
 *
 * Uso: npm run test:api (necesita Postgres local migrado en DATABASE_URL)
 */
import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";

import { eq } from "drizzle-orm";

process.env.ADMIN_PASSWORD = "clave-de-prueba";
process.env.ADMIN_EMAILS = "duenio@example.com";

const { db, pool, resetDb, schema, seedProduct } = await import("./db.mts");
const { createAdminSessionValue } = await import("../../src/lib/admin-auth");
const { addAdminAccess } = await import("../../src/lib/admin-access");
const { reserveOrderStock } = await import("../../src/lib/order-status");
const { POST } = await import("../../src/app/api/admin/orders/[code]/returns/route");

const BASE = "http://localhost:3000";

async function cookie(email = "duenio@example.com"): Promise<string> {
  return `admin_session=${encodeURIComponent((await createAdminSessionValue(email))!)}`;
}

async function devolver(code: string, body: unknown, cookieHeader?: string) {
  const res = await POST(
    new Request(`${BASE}/api/admin/orders/${code}/returns`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookieHeader ?? (await cookie()), origin: BASE },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ code }) },
  );
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

/** Pedido con dos productos: uno con stock real (10) y otro migrado de WooCommerce (1 = disponible). */
async function crearPedido(code: string, status = "enviado") {
  const real = `${code.toLowerCase()}-real`;
  const woo = `${code.toLowerCase()}-woo`;
  await seedProduct(real, 50_000, 10);
  await seedProduct(woo, 20_000, 1);
  const [order] = await db
    .insert(schema.orders)
    .values({
      code,
      status: "pendiente_pago",
      customerName: "Ana Pérez",
      email: "ana@example.com",
      phone: "3515551234",
      deliveryMethod: "pickup",
      paymentMethod: "transferencia",
      subtotal: 170_000,
      total: 170_000,
    })
    .returning();
  const items = await db
    .insert(schema.orderItems)
    .values([
      { orderId: order.id, productSlug: real, name: "Auriculares", unitPrice: 50_000, quantity: 3 },
      { orderId: order.id, productSlug: woo, name: "Funda", unitPrice: 20_000, quantity: 1 },
    ])
    .returning();
  await db.transaction((tx) => reserveOrderStock(tx, order.id));
  // La funda se agotó después de la venta (alguien la marcó sin stock).
  await db.update(schema.products).set({ stock: 0 }).where(eq(schema.products.slug, woo));
  await db.update(schema.orders).set({ status }).where(eq(schema.orders.id, order.id));
  return { order, real, woo, auris: items[0].id, funda: items[1].id };
}

async function stock(slug: string) {
  const [p] = await db.select({ stock: schema.products.stock, soldCount: schema.products.soldCount }).from(schema.products).where(eq(schema.products.slug, slug));
  return p;
}

beforeEach(() => resetDb());
after(() => pool.end());

test("sin sesión 401; un empleado del panel sí puede anotar la devolución", async () => {
  const p = await crearPedido("CD-DDDDD1");
  assert.equal((await devolver("CD-DDDDD1", { items: [{ orderItemId: p.auris, quantity: 1 }], reason: "falla" }, "")).status, 401);
  await addAdminAccess("empleado@example.com", "duenio@example.com");
  const res = await devolver("CD-DDDDD1", { items: [{ orderItemId: p.auris, quantity: 1 }], reason: "falla" }, await cookie("empleado@example.com"));
  assert.equal(res.status, 200, JSON.stringify(res.body));
});

test("devolución parcial: vuelven las unidades al stock real y queda la nota", async () => {
  const p = await crearPedido("CD-DDDDD2");
  assert.equal((await stock(p.real)).stock, 7);
  const res = await devolver("CD-DDDDD2", { items: [{ orderItemId: p.auris, quantity: 2 }], reason: "arrepentimiento" });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(await stock(p.real), { stock: 9, soldCount: 1 });
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, p.order.id));
  assert.equal(order.status, "enviado", "el pedido no cambia de estado");
  const eventos = await db.select().from(schema.orderEvents).where(eq(schema.orderEvents.orderId, p.order.id));
  assert.ok(eventos.some((e) => e.note.includes("Devolución recibida: 2 × Auriculares")));
  const filas = await db.select().from(schema.orderReturns).where(eq(schema.orderReturns.orderId, p.order.id));
  assert.equal(filas.length, 1);
  assert.equal(filas[0].createdBy, "duenio@example.com");
});

test("producto migrado (stock 1/0): vuelve a figurar disponible, sin inventar unidades", async () => {
  const p = await crearPedido("CD-DDDDD3", "entregado");
  const res = await devolver("CD-DDDDD3", { items: [{ orderItemId: p.funda, quantity: 1 }], reason: "cambio" });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal((await stock(p.woo)).stock, 1);
});

test("no se puede devolver más de lo comprado, sumando devoluciones anteriores", async () => {
  const p = await crearPedido("CD-DDDDD4");
  assert.equal((await devolver("CD-DDDDD4", { items: [{ orderItemId: p.auris, quantity: 4 }], reason: "x" })).status, 400);
  assert.equal((await devolver("CD-DDDDD4", { items: [{ orderItemId: p.auris, quantity: 2 }], reason: "x" })).status, 200);
  const res = await devolver("CD-DDDDD4", { items: [{ orderItemId: p.auris, quantity: 2 }], reason: "x" });
  assert.equal(res.status, 400);
  assert.match(String(res.body.error), /hasta 1/);
  // El mismo ítem repetido en un envío cuenta sumado.
  assert.equal((await devolver("CD-DDDDD4", { items: [{ orderItemId: p.auris, quantity: 1 }, { orderItemId: p.auris, quantity: 1 }], reason: "x" })).status, 400);
  assert.equal((await stock(p.real)).stock, 9, "los rechazados no tocan el stock");
});

test("dos devoluciones del mismo ítem a la vez: pasa una sola", async () => {
  const p = await crearPedido("CD-DDDDD5");
  const body = { items: [{ orderItemId: p.auris, quantity: 2 }], reason: "x" };
  const [a, b] = await Promise.all([devolver("CD-DDDDD5", body), devolver("CD-DDDDD5", body)]);
  assert.deepEqual([a.status, b.status].sort(), [200, 400]);
  assert.equal((await stock(p.real)).stock, 9);
});

test("pedido que no salió o ítem de otro pedido: rechazado", async () => {
  const p = await crearPedido("CD-DDDDD6", "preparando");
  const res = await devolver("CD-DDDDD6", { items: [{ orderItemId: p.auris, quantity: 1 }], reason: "x" });
  assert.equal(res.status, 409);
  const otro = await crearPedido("CD-DDDDD7");
  assert.equal((await devolver("CD-DDDDD7", { items: [{ orderItemId: p.auris, quantity: 1 }], reason: "x" })).status, 400);
  assert.equal((await devolver("CD-DDDDD7", { items: [{ orderItemId: otro.auris, quantity: 1 }], reason: "  " })).status, 400);
  assert.equal((await devolver("CD-DDDDD7", { items: [], reason: "x" })).status, 400);
  assert.equal((await devolver("CD-DDDDD7", { items: [{ orderItemId: otro.auris, quantity: "1" }], reason: "x" })).status, 400);
  assert.equal((await devolver("CD-NOEXISTE", { items: [{ orderItemId: otro.auris, quantity: 1 }], reason: "x" })).status, 404);
});
