/**
 * Pedido cargado desde el panel: solo con sesión, y con las mismas reglas que
 * el checkout (precio, stock y envío del servidor, stock reservado).
 *
 * Uso: npm run test:api (necesita Postgres local migrado en DATABASE_URL)
 */
import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";

import { eq } from "drizzle-orm";

process.env.ADMIN_PASSWORD = "clave-de-prueba";

const { comprador, db, domicilio, pool, post, resetDb, schema, seedProduct } = await import("./db.mts");
const { createAdminSessionValue } = await import("../../src/lib/admin-auth");
const { POST } = await import("../../src/app/api/admin/orders/manual/route");
const { POST: checkout } = await import("../../src/app/api/checkout/route");

const PATH = "/api/admin/orders/manual";

async function cookie(): Promise<Record<string, string>> {
  const value = await createAdminSessionValue("");
  assert.ok(value);
  return { cookie: `admin_session=${encodeURIComponent(value)}` };
}

async function cargar(body: unknown, headers?: Record<string, string>) {
  const res = await POST(post(PATH, body, headers ?? (await cookie())));
  return { status: res.status, body: await res.json() };
}

async function stock(slug: string) {
  const [row] = await db.select({ stock: schema.products.stock }).from(schema.products).where(eq(schema.products.slug, slug));
  return row.stock;
}

beforeEach(resetDb);
after(() => pool.end());

test("sin sesión del panel responde 401 y no crea nada", async () => {
  await seedProduct("tele", 100_000, 5);
  const res = await cargar({ items: [{ slug: "tele", quantity: 1 }], customer: comprador }, {});
  assert.equal(res.status, 401);
  assert.equal((await db.select().from(schema.orders)).length, 0);
});

test("crea el pedido pendiente de pago con el precio de la base y reserva el stock", async () => {
  await seedProduct("tele", 100_000, 5);
  const res = await cargar({
    items: [{ slug: "tele", quantity: 2, price: 1 }],
    customer: comprador,
    payment: { method: "transferencia" },
    subtotal: 1,
    total: 1,
  });
  assert.equal(res.status, 200);
  assert.match(res.body.code, /^CD-[A-Z2-9]{6}$/);
  assert.match(res.body.link, new RegExp(`/pedido/${res.body.code}$`));

  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.code, res.body.code));
  assert.equal(order.status, "pendiente_pago");
  assert.equal(order.subtotal, 200_000);
  assert.equal(order.total, res.body.total);
  assert.equal(order.deliveryMethod, "pickup");
  const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, order.id));
  assert.equal(items[0].unitPrice, 100_000);
  assert.equal(items[0].stockReserved, 2);
  assert.equal(await stock("tele"), 3);
  const events = await db.select().from(schema.orderEvents).where(eq(schema.orderEvents.orderId, order.id));
  assert.equal(events[0].note, "Pedido cargado desde el panel");
});

test("no deja cargar más unidades que el stock", async () => {
  await seedProduct("tele", 100_000, 2);
  const res = await cargar({ items: [{ slug: "tele", quantity: 3 }], customer: comprador });
  assert.equal(res.status, 409);
  assert.equal(await stock("tele"), 2);
  assert.equal((await db.select().from(schema.orders)).length, 0);
});

test("sin stock responde 409", async () => {
  await seedProduct("tele", 100_000, 0);
  const res = await cargar({ items: [{ slug: "tele", quantity: 1 }], customer: comprador });
  assert.equal(res.status, 409);
});

test("efectivo solo retirando en el local", async () => {
  await seedProduct("tele", 100_000, 5);
  const res = await cargar({ items: [{ slug: "tele", quantity: 1 }], customer: comprador, delivery: domicilio, payment: { method: "efectivo" } });
  assert.equal(res.status, 400);
  assert.ok(res.body.errors.payment);
});

test("envío a domicilio pide la dirección y suma el envío", async () => {
  await seedProduct("tele", 100_000, 5);
  const sinCalle = await cargar({ items: [{ slug: "tele", quantity: 1 }], customer: comprador, delivery: { method: "standard", zip: "5000" } });
  assert.equal(sinCalle.status, 400);
  assert.ok(sinCalle.body.errors.street);

  const res = await cargar({ items: [{ slug: "tele", quantity: 1 }], customer: comprador, delivery: domicilio });
  assert.equal(res.status, 200);
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.code, res.body.code));
  assert.equal(order.deliveryMethod, "standard");
  assert.equal(order.address?.street, "27 de Abril");
  assert.equal(order.total, order.subtotal - order.discount + order.paymentAdjustment + order.shippingCost);
});

test("pide los datos del cliente", async () => {
  await seedProduct("tele", 100_000, 5);
  const res = await cargar({ items: [{ slug: "tele", quantity: 1 }], customer: { firstName: "Ana" } });
  assert.equal(res.status, 400);
  assert.ok(res.body.errors.email || res.body.errors.phone);
});

test("venta en el local: queda entregada, baja el stock y alcanza con nombre y apellido", async () => {
  await seedProduct("tele", 100_000, 5);
  const res = await cargar({
    items: [{ slug: "tele", quantity: 2, price: 1 }],
    customer: { firstName: "Juan", lastName: "Pérez" },
    delivery: { method: "pickup" },
    payment: { method: "efectivo" },
    counterSale: true,
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.delivered, true);
  assert.equal(res.body.total, 200_000);

  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.code, res.body.code));
  assert.equal(order.status, "entregado");
  assert.equal(order.total, 200_000);
  assert.equal(order.email, "");
  assert.equal(await stock("tele"), 3);
  const events = await db.select().from(schema.orderEvents).where(eq(schema.orderEvents.orderId, order.id));
  assert.deepEqual(
    events.map((e) => e.toStatus),
    ["entregado"],
  );
});

test("venta en el local: si cargan un email, tiene que ser válido", async () => {
  await seedProduct("tele", 100_000, 5);
  const res = await cargar({
    items: [{ slug: "tele", quantity: 1 }],
    customer: { firstName: "Juan", lastName: "Pérez", email: "no-es-email" },
    payment: { method: "efectivo" },
    counterSale: true,
  });
  assert.equal(res.status, 400);
  assert.ok(res.body.errors.email);
  assert.equal(await stock("tele"), 5);
});

test("venta en el local: no se puede con envío a domicilio", async () => {
  await seedProduct("tele", 100_000, 5);
  const res = await cargar({
    items: [{ slug: "tele", quantity: 1 }],
    customer: comprador,
    delivery: domicilio,
    payment: { method: "transferencia" },
    counterSale: true,
  });
  assert.equal(res.status, 400);
  assert.equal((await db.select().from(schema.orders)).length, 0);
  assert.equal(await stock("tele"), 5);
});

test("sin marcar la venta en el local, el email sigue siendo obligatorio", async () => {
  await seedProduct("tele", 100_000, 5);
  const res = await cargar({
    items: [{ slug: "tele", quantity: 1 }],
    customer: { firstName: "Juan", lastName: "Pérez" },
    payment: { method: "efectivo" },
  });
  assert.equal(res.status, 400);
  assert.ok(res.body.errors.email);
});

test("la tienda y el panel arman el mismo pedido para el mismo carrito", async () => {
  await seedProduct("tele", 100_000, 10);
  const carrito = { items: [{ slug: "tele", quantity: 2 }], customer: comprador, delivery: domicilio, payment: { method: "transferencia" } };
  const web = await checkout(post("/api/checkout", carrito));
  assert.equal(web.status, 200);
  const panel = await cargar({ ...carrito, delivery: { ...domicilio, method: "standard" } });
  assert.equal(panel.status, 200, JSON.stringify(panel.body));

  const [deWeb, delPanel] = await Promise.all(
    [((await web.json()) as { code: string }).code, panel.body.code as string].map(async (code) => {
      const [order] = await db.select().from(schema.orders).where(eq(schema.orders.code, code));
      const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, order.id));
      return { order, items };
    }),
  );
  for (const field of ["subtotal", "shippingCost", "total", "deliveryLabel", "paymentLabel", "status"] as const) {
    assert.equal(delPanel.order[field], deWeb.order[field], field);
  }
  assert.deepEqual(
    delPanel.items.map((i) => [i.productSlug, i.unitPrice, i.quantity, i.stockReserved]),
    deWeb.items.map((i) => [i.productSlug, i.unitPrice, i.quantity, i.stockReserved]),
  );
  assert.equal(await stock("tele"), 6);
});
