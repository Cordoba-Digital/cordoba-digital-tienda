/**
 * Órdenes sin pago: no son reservas hasta que llega la plata (Ronan, 19/10).
 *
 * - Retirar en el local es con seña de $10.000; la reserva se confirma con la
 *   seña acreditada y vence a las 24 hs si no llega.
 * - Una orden sin pago guarda el stock 2 hs; después vuelve a la venta y, si
 *   el pago llega, se descuenta de nuevo.
 * - Un mismo email o teléfono no puede tener más de 2 órdenes sin pago.
 *
 * Uso: npm run test:api
 */
import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";

import { eq, sql } from "drizzle-orm";

import { comprador, db, domicilio, pool, post, resetDb, schema, seedProduct } from "./db.mts";

delete process.env.MP_ACCESS_TOKEN;
const { POST } = await import("../../src/app/api/checkout/route");
const { applyOrderStatus, expireStalePendingOrders, releaseStaleStockHolds } = await import("../../src/lib/order-status");
const { amountDueOnline, SENA_PESOS } = await import("../../src/lib/pricing");

async function comprar(body: Record<string, unknown> = {}) {
  const res = await POST(
    post("/api/checkout", {
      customer: comprador,
      delivery: domicilio,
      payment: { method: "transferencia" },
      items: [{ slug: "tele", quantity: 1 }],
      ...body,
    }),
  );
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

async function orden(code: unknown) {
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.code, code as string));
  return order;
}

async function producto(slug = "tele") {
  const [row] = await db
    .select({ stock: schema.products.stock, soldCount: schema.products.soldCount })
    .from(schema.products)
    .where(eq(schema.products.slug, slug));
  return row;
}

async function envejecer(id: number, horas: number): Promise<void> {
  await db.execute(sql`update orders set created_at = now() - make_interval(hours => ${horas}) where id = ${id}`);
}

async function notas(id: number): Promise<string[]> {
  const rows = await db.select({ note: schema.orderEvents.note }).from(schema.orderEvents).where(eq(schema.orderEvents.orderId, id));
  return rows.map((r) => r.note);
}

beforeEach(async () => {
  await resetDb();
  await seedProduct("tele", 300_000, 5);
});
after(() => pool.end());

test("retirando en el local se paga una seña de $10.000 y el resto en el mostrador", async () => {
  const res = await comprar({ delivery: { method: "pickup" }, payment: { method: "sena" } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const order = await orden(res.body.code);
  assert.equal(order.paymentMethod, "sena");
  assert.equal(order.total, 300_000, "el total es el del pedido; la seña es solo lo que se transfiere");
  assert.equal(amountDueOnline(order), SENA_PESOS);
  assert.equal(SENA_PESOS, 10_000);
});

test("la seña no se acepta con envío a domicilio", async () => {
  const res = await comprar({ payment: { method: "sena" } });
  assert.equal(res.status, 400);
});

test("la seña nunca es más que el total", () => {
  assert.equal(amountDueOnline({ paymentMethod: "sena", total: 6_000 }), 6_000);
  assert.equal(amountDueOnline({ paymentMethod: "transferencia", total: 6_000 }), 6_000);
});

test("un mismo email no puede tener más de 2 órdenes sin pago", async () => {
  assert.equal((await comprar()).status, 200);
  assert.equal((await comprar()).status, 200);
  const tercera = await comprar();
  assert.equal(tercera.status, 429);
  assert.match(String(tercera.body.error), /2 órdenes esperando el pago/);
  assert.equal((await producto()).stock, 3, "la orden rechazada no descontó stock");
});

test("el tope cuenta el mismo teléfono escrito distinto, con otro email", async () => {
  assert.equal((await comprar()).status, 200);
  assert.equal((await comprar({ customer: { ...comprador, email: "otra@example.com" } })).status, 200);
  const res = await comprar({ customer: { ...comprador, email: "tercera@example.com", phone: "+54 9 351 5551234" } });
  assert.equal(res.status, 429);
});

test("pagada una orden, se puede hacer otra", async () => {
  const primera = await comprar();
  assert.equal((await comprar()).status, 200);
  const order = await orden(primera.body.code);
  assert.ok(await applyOrderStatus(order.id, { from: "pendiente_pago", to: "pago_confirmado" }));
  assert.equal((await comprar()).status, 200);
});

test("a las 2 hs sin pago el stock vuelve a la venta y la orden sigue abierta", async () => {
  const order = await orden((await comprar()).body.code);
  assert.deepEqual(await producto(), { stock: 4, soldCount: 1 });

  await envejecer(order.id, 1);
  assert.equal(await releaseStaleStockHolds(), 0, "antes de las 2 hs no se toca");

  await envejecer(order.id, 3);
  assert.equal(await releaseStaleStockHolds(), 1);
  assert.deepEqual(await producto(), { stock: 5, soldCount: 0 });
  assert.equal((await orden(order.code)).status, "pendiente_pago");
  assert.equal(await releaseStaleStockHolds(), 0, "no se libera dos veces");
  assert.deepEqual(await producto(), { stock: 5, soldCount: 0 });
});

test("si el pago llega después de liberar el stock, se descuenta de nuevo", async () => {
  const order = await orden((await comprar()).body.code);
  await envejecer(order.id, 3);
  await releaseStaleStockHolds();

  assert.ok(await applyOrderStatus(order.id, { from: "pendiente_pago", to: "pago_confirmado" }));
  assert.deepEqual(await producto(), { stock: 4, soldCount: 1 });
  // Cancelarlo después devuelve el stock una sola vez.
  assert.ok(await applyOrderStatus(order.id, { from: "pago_confirmado", to: "cancelado" }));
  assert.deepEqual(await producto(), { stock: 5, soldCount: 0 });
});

test("cancelar una orden que ya liberó el stock no lo devuelve dos veces", async () => {
  const order = await orden((await comprar()).body.code);
  await envejecer(order.id, 3);
  await releaseStaleStockHolds();
  assert.ok(await applyOrderStatus(order.id, { from: "pendiente_pago", to: "cancelado" }));
  assert.deepEqual(await producto(), { stock: 5, soldCount: 0 });
});

test("si el pago llega tarde y ya no hay stock, queda anotado para el local", async () => {
  const order = await orden((await comprar()).body.code);
  await envejecer(order.id, 3);
  await releaseStaleStockHolds();
  await db.update(schema.products).set({ stock: 0 }).where(eq(schema.products.slug, "tele"));

  assert.ok(await applyOrderStatus(order.id, { from: "pendiente_pago", to: "pago_confirmado" }));
  assert.ok((await notas(order.id)).some((n) => /falta stock de Producto tele/.test(n)));
});

test("una compra nueva libera antes el stock de las órdenes viejas sin pago", async () => {
  await db.update(schema.products).set({ stock: 2 }).where(eq(schema.products.slug, "tele"));
  const vieja = await orden((await comprar({ items: [{ slug: "tele", quantity: 2 }] })).body.code);
  assert.equal((await producto()).stock, 0);
  await envejecer(vieja.id, 3);
  const res = await comprar({ customer: { ...comprador, email: "otro@example.com", phone: "351 444-0000" } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
});

test("la seña vence a las 24 hs; la transferencia, a las 48", async () => {
  const sena = await orden((await comprar({ delivery: { method: "pickup" }, payment: { method: "sena" } })).body.code);
  const transferencia = await orden((await comprar()).body.code);
  await envejecer(sena.id, 25);
  await envejecer(transferencia.id, 25);

  assert.equal(await expireStalePendingOrders(), 1);
  assert.equal((await orden(sena.code)).status, "cancelado");
  assert.equal((await orden(transferencia.code)).status, "pendiente_pago");
  assert.ok((await notas(sena.id)).includes("Vencido: sin pago en 24 hs."));
  assert.deepEqual(await producto(), { stock: 5, soldCount: 0 }, "el stock de las dos volvió una sola vez");
});
