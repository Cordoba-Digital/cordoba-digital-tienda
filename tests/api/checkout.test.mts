/**
 * El checkout contra una base real: precios, stock y cupones salen siempre del
 * servidor, y pedido, ítems y stock se guardan juntos.
 *
 * Uso: npm run test:api (necesita Postgres local migrado en DATABASE_URL)
 */
import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";

import { eq } from "drizzle-orm";

import { comprador, db, domicilio, pool, post, resetDb, schema, seedProduct } from "./db.mts";

delete process.env.MP_ACCESS_TOKEN;
const { POST } = await import("../../src/app/api/checkout/route");
const { findShippingOption } = await import("../../src/lib/shipping");
const { CHECKOUT_LIMIT, COUPON_LIMIT, recordMiss } = await import("../../src/lib/rate-limit");

const envio = findShippingOption("5000", "standard")!.cost;

async function checkout(body: Record<string, unknown>) {
  const res = await POST(post("/api/checkout", { customer: comprador, delivery: domicilio, payment: { method: "transferencia" }, ...body }));
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

async function pedido(code: string) {
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.code, code));
  const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, order.id));
  return { order, items };
}

async function stock(slug: string) {
  const [row] = await db.select({ stock: schema.products.stock }).from(schema.products).where(eq(schema.products.slug, slug));
  return row.stock;
}

beforeEach(resetDb);
after(() => pool.end());

test("crea el pedido con el precio de la base, no el que manda el navegador", async () => {
  await seedProduct("celu", 500_000, 10);
  const res = await checkout({ items: [{ slug: "celu", quantity: 2, price: 1 }], total: 1 });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const { order, items } = await pedido(res.body.code as string);
  assert.equal(order.status, "pendiente_pago");
  assert.equal(order.subtotal, 1_000_000);
  assert.equal(order.shippingCost, envio);
  assert.equal(order.total, 1_000_000 + envio);
  assert.equal(res.body.total, order.total);
  assert.deepEqual(items.map((i) => [i.productSlug, i.unitPrice, i.quantity]), [["celu", 500_000, 2]]);
});

test("el código de pedido no es predecible", async () => {
  await seedProduct("celu", 1_000, 10);
  const a = await checkout({ items: [{ slug: "celu", quantity: 1 }] });
  const b = await checkout({ items: [{ slug: "celu", quantity: 1 }] });
  assert.match(a.body.code as string, /^CD-[A-Z2-9]{6}$/);
  assert.notEqual(a.body.code, b.body.code);
});

test("descuenta el stock real y anota cuánto reservó", async () => {
  await seedProduct("tele", 100_000, 3);
  const res = await checkout({ items: [{ slug: "tele", quantity: 5 }] });
  const { items } = await pedido(res.body.code as string);
  assert.equal(items[0].quantity, 3, "recorta a lo que hay");
  assert.equal(items[0].stockReserved, 3);
  assert.equal(await stock("tele"), 0);
});

test("stock 1 es disponibilidad migrada: no se agota con la primera venta", async () => {
  await seedProduct("migrado", 10_000, 1);
  await checkout({ items: [{ slug: "migrado", quantity: 2 }] });
  assert.equal(await stock("migrado"), 1);
});

test("sin stock responde 409 y no crea nada", async () => {
  await seedProduct("agotado", 10_000, 0);
  const res = await checkout({ items: [{ slug: "agotado", quantity: 1 }] });
  assert.equal(res.status, 409);
  assert.equal((await db.select().from(schema.orders)).length, 0);
});

test("el mismo producto en dos líneas respeta el tope de 5", async () => {
  await seedProduct("auri", 20_000, 50);
  const res = await checkout({ items: [{ slug: "auri", quantity: 4 }, { slug: "auri", quantity: 4 }] });
  const { items } = await pedido(res.body.code as string);
  assert.equal(items.length, 1);
  assert.equal(items[0].quantity, 5);
});

test("producto inexistente responde 409", async () => {
  const res = await checkout({ items: [{ slug: "no-existe", quantity: 1 }] });
  assert.equal(res.status, 409);
});

test("aplica el cupón en el servidor e ignora uno inventado", async () => {
  await seedProduct("note", 1_000_000, 10);
  await db.insert(schema.coupons).values({ code: "BIENVENIDA", kind: "percent", value: 10, minSubtotal: 0 });
  const con = await checkout({ items: [{ slug: "note", quantity: 1 }], couponCode: "bienvenida" });
  assert.equal((await pedido(con.body.code as string)).order.discount, 100_000);
  const sin = await checkout({ items: [{ slug: "note", quantity: 1 }], couponCode: "TRUCHO" });
  assert.equal((await pedido(sin.body.code as string)).order.discount, 0);
});

test("un cupón pausado no descuenta", async () => {
  await seedProduct("note", 1_000_000, 10);
  await db.insert(schema.coupons).values({ code: "PAUSADO", kind: "fixed", value: 50_000, minSubtotal: 0, active: false });
  const res = await checkout({ items: [{ slug: "note", quantity: 1 }], couponCode: "PAUSADO" });
  assert.equal((await pedido(res.body.code as string)).order.discount, 0);
});

test("retiro en el local no cobra envío ni pide domicilio", async () => {
  await seedProduct("celu", 100_000, 10);
  const res = await checkout({ items: [{ slug: "celu", quantity: 1 }], delivery: { method: "pickup" }, payment: { method: "efectivo" } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const { order } = await pedido(res.body.code as string);
  assert.equal(order.shippingCost, 0);
  assert.equal(order.total, 100_000);
});

test("rechaza Mercado Pago si no está configurado", async () => {
  await seedProduct("celu", 100_000, 10);
  const res = await checkout({ items: [{ slug: "celu", quantity: 1 }], payment: { method: "mercadopago" } });
  assert.equal(res.status, 400);
  assert.ok((res.body.errors as Record<string, string>).payment);
});

test("carrito vacío o datos con tipos raros responden 400, no 500", async () => {
  assert.equal((await checkout({ items: [] })).status, 400);
  assert.equal((await checkout({ items: [{ slug: "x", quantity: 1 }], customer: { firstName: 123, email: ["a"] } })).status, 400);
  assert.equal((await checkout({ items: "todo" })).status, 400);
});

test("cada pedido cuenta para el límite por IP y al pasarse responde 429", async () => {
  await seedProduct("note", 1_000_000, 10);
  const ip = { "x-real-ip": "200.1.2.3" };
  const pedir = () =>
    POST(post("/api/checkout", { customer: comprador, delivery: domicilio, payment: { method: "transferencia" }, items: [{ slug: "note", quantity: 1 }] }, ip));
  assert.equal((await pedir()).status, 200);
  for (let i = 1; i < CHECKOUT_LIMIT.max; i += 1) await recordMiss(CHECKOUT_LIMIT, "200.1.2.3");
  const bloqueado = await pedir();
  assert.equal(bloqueado.status, 429);
  assert.ok(bloqueado.headers.get("retry-after"));
  assert.equal((await db.select().from(schema.orders)).length, 1);
  // Otra IP sigue comprando.
  const otra = await POST(post("/api/checkout", { customer: comprador, delivery: domicilio, payment: { method: "transferencia" }, items: [{ slug: "note", quantity: 1 }] }, { "x-real-ip": "200.9.9.9" }));
  assert.equal(otra.status, 200);
});

test("un cupón inventado en el checkout cuenta como intento fallido", async () => {
  await seedProduct("note", 1_000_000, 10);
  const ip = { "x-real-ip": "200.4.5.6" };
  const pedir = (couponCode?: string) =>
    POST(post("/api/checkout", { customer: comprador, delivery: domicilio, payment: { method: "transferencia" }, items: [{ slug: "note", quantity: 1 }], couponCode }, ip));
  assert.equal((await pedir("TRUCHO1")).status, 200);
  for (let i = 1; i < COUPON_LIMIT.max; i += 1) await recordMiss(COUPON_LIMIT, "200.4.5.6");
  assert.equal((await pedir("TRUCHO2")).status, 429);
  // Sin cupón puede seguir comprando.
  assert.equal((await pedir()).status, 200);
});

test("el mismo intento de compra mandado dos veces crea un solo pedido", async () => {
  await seedProduct("tele", 100_000, 5);
  const checkoutKey = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const primero = await checkout({ items: [{ slug: "tele", quantity: 2 }], checkoutKey });
  const segundo = await checkout({ items: [{ slug: "tele", quantity: 2 }], checkoutKey });
  assert.equal(segundo.status, 200);
  assert.equal(segundo.body.code, primero.body.code);
  assert.equal(segundo.body.total, primero.body.total);
  assert.equal((await db.select().from(schema.orders)).length, 1);
  assert.equal(await stock("tele"), 3, "el stock se reserva una sola vez");
});

test("dos envíos simultáneos con la misma clave dejan un pedido y el stock bien", async () => {
  await seedProduct("tele", 100_000, 10);
  const checkoutKey = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const respuestas = await Promise.all(
    Array.from({ length: 4 }, () => checkout({ items: [{ slug: "tele", quantity: 1 }], checkoutKey })),
  );
  assert.deepEqual(respuestas.map((r) => r.status), [200, 200, 200, 200]);
  assert.equal(new Set(respuestas.map((r) => r.body.code)).size, 1);
  assert.equal((await db.select().from(schema.orders)).length, 1);
  assert.equal(await stock("tele"), 9);
});

test("sin clave, o con otra clave, cada envío es un pedido nuevo", async () => {
  await seedProduct("tele", 100_000, 10);
  await checkout({ items: [{ slug: "tele", quantity: 1 }] });
  await checkout({ items: [{ slug: "tele", quantity: 1 }] });
  await checkout({ items: [{ slug: "tele", quantity: 1 }], checkoutKey: "11111111-1111-4111-8111-111111111111" });
  await checkout({ items: [{ slug: "tele", quantity: 1 }], checkoutKey: "22222222-2222-4222-8222-222222222222" });
  assert.equal((await db.select().from(schema.orders)).length, 4);
});

test("la clave de otra persona no devuelve su pedido", async () => {
  await seedProduct("tele", 100_000, 10);
  const checkoutKey = "33333333-3333-4333-8333-333333333333";
  const ana = await checkout({ items: [{ slug: "tele", quantity: 1 }], checkoutKey });
  const otro = await checkout({ items: [{ slug: "tele", quantity: 1 }], checkoutKey, customer: { ...comprador, email: "otro@example.com" } });
  assert.equal(otro.status, 409);
  assert.notEqual(otro.body.code, ana.body.code);
  assert.equal((await db.select().from(schema.orders)).length, 1);
  assert.equal(await stock("tele"), 9);
});
