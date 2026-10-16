/**
 * Respaldo del webhook de Mercado Pago: la página del pedido (cuando el cliente
 * vuelve de MP) y el cron diario acreditan el pago aunque el aviso no llegue.
 * Mismas reglas que el webhook: el pago tiene que ser de ese pedido y por el
 * total exacto.
 *
 * Uso: npm run test:api (necesita Postgres local migrado en DATABASE_URL)
 */
import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";

import { eq } from "drizzle-orm";

const { db, pool, resetDb, schema, seedProduct } = await import("./db.mts");
const { reconcileMpPayment, syncPendingMpOrders } = await import("../../src/lib/checkout-mp-sync");
const { reserveOrderStock } = await import("../../src/lib/order-status");

process.env.MP_ACCESS_TOKEN = "TEST-token";

const pagos = new Map<string, Record<string, unknown>>();
const fetchReal = globalThis.fetch;
globalThis.fetch = (async (input: string | URL | Request) => {
  const url = new URL(String(input instanceof Request ? input.url : input));
  if (url.origin === "https://api.mercadopago.com" && url.pathname === "/v1/payments/search") {
    const ref = url.searchParams.get("external_reference");
    const status = url.searchParams.get("status");
    const results = [...pagos.values()].filter((p) => p.external_reference === ref && (!status || p.status === status));
    return Response.json({ results });
  }
  if (url.origin === "https://api.mercadopago.com" && url.pathname.startsWith("/v1/payments/")) {
    const pago = pagos.get(url.pathname.slice("/v1/payments/".length));
    return pago ? Response.json(pago) : new Response(null, { status: 404 });
  }
  return fetchReal(input);
}) as typeof fetch;

async function crearPedido(code: string, total: number) {
  await seedProduct(code.toLowerCase(), total, 10);
  const [order] = await db
    .insert(schema.orders)
    .values({
      code,
      status: "pendiente_pago",
      customerName: "Ana Pérez",
      email: "ana@example.com",
      phone: "3515551234",
      docId: "30123456",
      deliveryMethod: "pickup",
      deliveryLabel: "Retiro",
      deliveryEta: "",
      paymentMethod: "mercadopago",
      paymentLabel: "Mercado Pago",
      subtotal: total,
      total,
    })
    .returning();
  await db.insert(schema.orderItems).values({ orderId: order.id, productSlug: code.toLowerCase(), name: "Celu", image: "", unitPrice: total, quantity: 1 });
  await db.transaction((tx) => reserveOrderStock(tx, order.id));
  return order;
}

async function estado(id: number) {
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, id));
  const eventos = await db.select().from(schema.orderEvents).where(eq(schema.orderEvents.orderId, id));
  return { order, eventos };
}

beforeEach(async () => {
  pagos.clear();
  await resetDb();
});
after(() => pool.end());

test("al volver de Mercado Pago se acredita el pago aprobado por el total", async () => {
  const order = await crearPedido("CD-VUELTA", 80_000);
  pagos.set("101", { id: 101, status: "approved", external_reference: order.code, transaction_amount: 80_000 });
  assert.equal(await reconcileMpPayment("101", { expectedCode: order.code }), "acreditado");
  const { order: despues } = await estado(order.id);
  assert.equal(despues.status, "pago_confirmado");
  assert.equal(despues.mercadopagoPaymentId, "101");
});

test("un pago de otro pedido no acredita el pedido de la página", async () => {
  const mio = await crearPedido("CD-MIO", 80_000);
  const otro = await crearPedido("CD-OTRO", 80_000);
  pagos.set("102", { id: 102, status: "approved", external_reference: otro.code, transaction_amount: 80_000 });
  assert.equal(await reconcileMpPayment("102", { expectedCode: mio.code }), "sin_pedido");
  assert.equal((await estado(mio.id)).order.status, "pendiente_pago");
  assert.equal((await estado(otro.id)).order.status, "pendiente_pago");
});

test("un pago pendiente o rechazado no cambia el pedido", async () => {
  const order = await crearPedido("CD-PEND", 80_000);
  pagos.set("103", { id: 103, status: "pending", external_reference: order.code, transaction_amount: 80_000 });
  assert.equal(await reconcileMpPayment("103", { expectedCode: order.code }), "sin_cambios");
  assert.equal((await estado(order.id)).order.status, "pendiente_pago");
});

test("monto distinto deja el pedido pendiente y la nota no se repite al recargar", async () => {
  const order = await crearPedido("CD-MONTO", 80_000);
  pagos.set("104", { id: 104, status: "approved", external_reference: order.code, transaction_amount: 800 });
  assert.equal(await reconcileMpPayment("104", { expectedCode: order.code }), "monto_distinto");
  assert.equal(await reconcileMpPayment("104", { expectedCode: order.code }), "monto_distinto");
  const { order: despues, eventos } = await estado(order.id);
  assert.equal(despues.status, "pendiente_pago");
  assert.equal(eventos.filter((e) => /Revisar antes de despachar/.test(e.note ?? "")).length, 1);
});

test("un id que no es numérico no se consulta", async () => {
  assert.equal(await reconcileMpPayment("../users/me"), "no_disponible");
});

test("el cron acredita los pedidos cobrados cuyo aviso no llegó", async () => {
  const pagado = await crearPedido("CD-PAGADO", 50_000);
  const sinPagar = await crearPedido("CD-SINPAGAR", 50_000);
  pagos.set("201", { id: 201, status: "approved", external_reference: pagado.code, transaction_amount: 50_000 });
  assert.deepEqual(await syncPendingMpOrders(), { revisados: 2, acreditados: 1 });
  assert.equal((await estado(pagado.id)).order.status, "pago_confirmado");
  assert.equal((await estado(sinPagar.id)).order.status, "pendiente_pago");
});

test("sin credencial de Mercado Pago el cron no hace nada", async () => {
  const token = process.env.MP_ACCESS_TOKEN;
  delete process.env.MP_ACCESS_TOKEN;
  try {
    await crearPedido("CD-NADA", 50_000);
    assert.deepEqual(await syncPendingMpOrders(), { revisados: 0, acreditados: 0 });
  } finally {
    process.env.MP_ACCESS_TOKEN = token;
  }
});
