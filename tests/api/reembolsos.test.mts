/**
 * Reembolsos desde el panel: solo dueños, nunca más que lo cobrado, por la API
 * de Mercado Pago cuando el pedido se pagó ahí, y el pedido se cancela (con el
 * stock de vuelta) solo si se devolvió todo y no salió.
 *
 * Uso: npm run test:api (necesita Postgres local migrado en DATABASE_URL)
 */
import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";

import { eq } from "drizzle-orm";

process.env.ADMIN_PASSWORD = "clave-de-prueba";
process.env.ADMIN_EMAILS = "duenio@example.com";
process.env.MP_ACCESS_TOKEN = "TEST-token";

const { db, pool, resetDb, schema, seedProduct } = await import("./db.mts");
const { createAdminSessionValue } = await import("../../src/lib/admin-auth");
const { addAdminAccess } = await import("../../src/lib/admin-access");
const { reserveOrderStock } = await import("../../src/lib/order-status");
const { reconcileMpPayment } = await import("../../src/lib/checkout-mp-sync");
const { POST } = await import("../../src/app/api/admin/orders/[code]/refunds/route");

const BASE = "http://localhost:3000";

// MP de mentira: guarda los reembolsos pedidos y responde según `mpFalla`.
const pedidosMp: { paymentId: string; amount: number; key: string | null }[] = [];
const pagos = new Map<string, Record<string, unknown>>();
let mpFalla = false;
const fetchReal = globalThis.fetch;
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(String(input instanceof Request ? input.url : input));
  const refund = url.pathname.match(/^\/v1\/payments\/(\d+)\/refunds$/);
  if (url.origin === "https://api.mercadopago.com" && refund) {
    if (mpFalla) return Response.json({ message: "insufficient funds" }, { status: 400 });
    const body = JSON.parse(String(init?.body ?? "{}")) as { amount: number };
    const key = new Headers(init?.headers).get("x-idempotency-key");
    pedidosMp.push({ paymentId: refund[1], amount: body.amount, key });
    return Response.json({ id: 9000 + pedidosMp.length, amount: body.amount, status: "approved" }, { status: 201 });
  }
  if (url.origin === "https://api.mercadopago.com" && url.pathname.startsWith("/v1/payments/")) {
    const pago = pagos.get(url.pathname.slice("/v1/payments/".length));
    return pago ? Response.json(pago) : new Response(null, { status: 404 });
  }
  return fetchReal(input, init);
}) as typeof fetch;

async function cookie(email = "duenio@example.com"): Promise<string> {
  return `admin_session=${encodeURIComponent((await createAdminSessionValue(email))!)}`;
}

async function devolver(code: string, body: unknown, cookieHeader?: string) {
  const res = await POST(
    new Request(`${BASE}/api/admin/orders/${code}/refunds`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookieHeader ?? (await cookie()), origin: BASE },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ code }) },
  );
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

async function crearPedido(code: string, opts: { total?: number; status?: string; metodo?: string; pagoMp?: string | null; stock?: number } = {}) {
  const total = opts.total ?? 100_000;
  await seedProduct(code.toLowerCase(), total, opts.stock ?? 5);
  const metodo = opts.metodo ?? "mercadopago";
  const [order] = await db
    .insert(schema.orders)
    .values({
      code,
      status: "pendiente_pago",
      customerName: "Ana Pérez",
      email: "ana@example.com",
      phone: "3515551234",
      deliveryMethod: "pickup",
      paymentMethod: metodo,
      subtotal: total,
      total,
      mercadopagoPaymentId: metodo === "mercadopago" ? (opts.pagoMp === undefined ? "123" : opts.pagoMp) : null,
    })
    .returning();
  await db.insert(schema.orderItems).values({ orderId: order.id, productSlug: code.toLowerCase(), name: "Celu", unitPrice: total, quantity: 1 });
  await db.transaction((tx) => reserveOrderStock(tx, order.id));
  const status = opts.status ?? "pago_confirmado";
  if (status !== "pendiente_pago") {
    await db.update(schema.orders).set({ status }).where(eq(schema.orders.id, order.id));
    await db.insert(schema.orderEvents).values({ orderId: order.id, fromStatus: "pendiente_pago", toStatus: status });
  }
  return order;
}

async function estado(id: number, slug: string) {
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, id));
  const refunds = await db.select().from(schema.orderRefunds).where(eq(schema.orderRefunds.orderId, id));
  const [product] = await db.select({ stock: schema.products.stock }).from(schema.products).where(eq(schema.products.slug, slug));
  const eventos = await db.select().from(schema.orderEvents).where(eq(schema.orderEvents.orderId, id));
  return { order, refunds, stock: product.stock, eventos };
}

beforeEach(async () => {
  pedidosMp.length = 0;
  pagos.clear();
  mpFalla = false;
  await resetDb();
});
after(() => pool.end());

test("sin sesión 401; un admin que no es dueño no puede devolver plata", async () => {
  await crearPedido("CD-AAAAA1");
  assert.equal((await devolver("CD-AAAAA1", { amount: 1000, reason: "x" }, "")).status, 401);
  await addAdminAccess("empleado@example.com", "duenio@example.com");
  const res = await devolver("CD-AAAAA1", { amount: 1000, reason: "x" }, await cookie("empleado@example.com"));
  assert.equal(res.status, 403);
  assert.equal(pedidosMp.length, 0);
});

test("reembolso parcial por Mercado Pago: pide a MP, lo anota y el pedido sigue", async () => {
  const order = await crearPedido("CD-AAAAA2");
  const res = await devolver("CD-AAAAA2", { amount: 30_000, reason: "diferencia de precio" });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(pedidosMp.map((p) => [p.paymentId, p.amount]), [["123", 30_000]]);
  assert.match(pedidosMp[0].key ?? "", /^cd-reembolso-\d+$/);
  const { order: o, refunds, stock, eventos } = await estado(order.id, "cd-aaaaa2");
  assert.equal(o.status, "pago_confirmado");
  assert.equal(refunds.length, 1);
  assert.equal(refunds[0].estado, "hecho");
  assert.equal(refunds[0].externalId, "9001");
  assert.equal(stock, 4, "el stock no vuelve en un parcial");
  assert.ok(eventos.some((e) => e.note.includes("Reembolso de")));
});

test("devolver el total de un pedido que no salió lo cancela y devuelve el stock", async () => {
  const order = await crearPedido("CD-AAAAA3");
  await devolver("CD-AAAAA3", { amount: 40_000, reason: "parte" });
  const res = await devolver("CD-AAAAA3", { amount: 60_000, reason: "arrepentimiento" });
  assert.equal(res.status, 200);
  assert.equal(res.body.cancelled, true);
  const { order: o, stock } = await estado(order.id, "cd-aaaaa3");
  assert.equal(o.status, "cancelado");
  assert.equal(stock, 5);
});

test("no deja devolver más de lo cobrado", async () => {
  await crearPedido("CD-AAAAA4");
  await devolver("CD-AAAAA4", { amount: 80_000, reason: "parte" });
  const res = await devolver("CD-AAAAA4", { amount: 30_000, reason: "de más" });
  assert.equal(res.status, 400);
  assert.equal(pedidosMp.length, 1);
});

test("dos reembolsos a la vez no superan el total", async () => {
  await crearPedido("CD-AAAAA5");
  const respuestas = await Promise.all([
    devolver("CD-AAAAA5", { amount: 70_000, reason: "a" }),
    devolver("CD-AAAAA5", { amount: 70_000, reason: "b" }),
  ]);
  assert.deepEqual(respuestas.map((r) => r.status).sort(), [200, 400]);
  assert.equal(pedidosMp.length, 1);
});

test("un pedido sin pago acreditado no se puede devolver", async () => {
  await crearPedido("CD-AAAAA6", { status: "pendiente_pago" });
  const res = await devolver("CD-AAAAA6", { amount: 1_000, reason: "x" });
  assert.equal(res.status, 409);
});

test("si MP rechaza, queda anotado como fallido y no cuenta como devuelto", async () => {
  const order = await crearPedido("CD-AAAAA7");
  mpFalla = true;
  const res = await devolver("CD-AAAAA7", { amount: 100_000, reason: "x" });
  assert.equal(res.status, 502);
  mpFalla = false;
  const ok = await devolver("CD-AAAAA7", { amount: 100_000, reason: "x" });
  assert.equal(ok.status, 200);
  const { refunds, order: o } = await estado(order.id, "cd-aaaaa7");
  assert.deepEqual(refunds.map((r) => r.estado).sort(), ["fallido", "hecho"]);
  assert.equal(o.status, "cancelado");
});

test("transferencia: se anota la devolución hecha por fuera, sin llamar a MP", async () => {
  const order = await crearPedido("CD-AAAAA8", { metodo: "transferencia", status: "preparando" });
  const res = await devolver("CD-AAAAA8", { amount: 100_000, reason: "sin stock" });
  assert.equal(res.status, 200);
  assert.equal(pedidosMp.length, 0);
  const { refunds, order: o } = await estado(order.id, "cd-aaaaa8");
  assert.equal(refunds[0].method, "manual");
  assert.equal(o.status, "cancelado");
});

test("un pedido que ya salió no se cancela al devolver el total", async () => {
  const order = await crearPedido("CD-AAAAA9", { status: "enviado" });
  const res = await devolver("CD-AAAAA9", { amount: 100_000, reason: "llegó roto" });
  assert.equal(res.status, 200);
  assert.equal(res.body.cancelled, false);
  const { order: o } = await estado(order.id, "cd-aaaaa9");
  assert.equal(o.status, "enviado");
});

test("monto o motivo inválidos responden 400", async () => {
  await crearPedido("CD-AAAAB1");
  assert.equal((await devolver("CD-AAAAB1", { amount: 0, reason: "x" })).status, 400);
  assert.equal((await devolver("CD-AAAAB1", { amount: 1000, reason: "  " })).status, 400);
  assert.equal((await devolver("CD-AAAAB1", { amount: "1000", reason: "x" })).status, 400);
});

test("un reembolso hecho desde la cuenta de MP llega por el aviso y se anota una vez", async () => {
  const order = await crearPedido("CD-AAAAB2");
  pagos.set("123", {
    id: 123,
    status: "approved",
    external_reference: "CD-AAAAB2",
    transaction_amount: 100_000,
    refunds: [{ id: 777, amount: 20_000, status: "approved" }],
  });
  await reconcileMpPayment("123");
  await reconcileMpPayment("123");
  const { refunds, order: o } = await estado(order.id, "cd-aaaab2");
  assert.deepEqual(refunds.map((r) => [r.externalId, r.amount, r.method]), [["777", 20_000, "mercadopago"]]);
  assert.equal(o.status, "pago_confirmado");
  // Y cuenta para el tope del panel.
  assert.equal((await devolver("CD-AAAAB2", { amount: 90_000, reason: "x" })).status, 400);
});
