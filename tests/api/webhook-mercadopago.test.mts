/**
 * Webhook de Mercado Pago contra una base real. Ningún pedido pasa a pagado
 * sin firma válida y sin que el monto cobrado coincida con el total.
 *
 * Mercado Pago se simula: `fetch` devuelve el pago que arma cada caso, y
 * `after()` de Next corre el trabajo en el acto para poder esperarlo.
 *
 * Uso: npm run test:api (necesita Postgres local migrado en DATABASE_URL)
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, beforeEach, mock, test } from "node:test";

import { eq } from "drizzle-orm";

const pendientes: Promise<unknown>[] = [];
mock.module("next/server", { namedExports: { after: (fn: () => unknown) => pendientes.push(Promise.resolve(fn())) } });

const { db, pool, resetDb, schema, seedProduct } = await import("./db.mts");
const { POST } = await import("../../src/app/api/webhooks/mercadopago/route");
const { reserveOrderStock } = await import("../../src/lib/order-status");

const SECRET = "secreto-de-prueba";
process.env.MP_ACCESS_TOKEN = "TEST-token";

let pagoSimulado: Record<string, unknown> = {};
const fetchReal = globalThis.fetch;
globalThis.fetch = (async (input: string | URL | Request) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.startsWith("https://api.mercadopago.com/v1/payments/")) return Response.json(pagoSimulado);
  return fetchReal(input);
}) as typeof fetch;

function aviso(paymentId: string, { secret = SECRET, firma }: { secret?: string; firma?: string } = {}): Request {
  const ts = String(Date.now());
  const requestId = crypto.randomUUID();
  const v1 = firma ?? crypto.createHmac("sha256", secret).update(`id:${paymentId};request-id:${requestId};ts:${ts};`).digest("hex");
  return new Request(`http://localhost:3000/api/webhooks/mercadopago?data.id=${paymentId}&type=payment`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": requestId },
    body: JSON.stringify({ type: "payment", data: { id: paymentId } }),
  });
}

async function enviar(req: Request): Promise<number> {
  const res = await POST(req);
  await Promise.all(pendientes.splice(0));
  return res.status;
}

async function crearPedido(total: number, stock = 10) {
  await seedProduct("celu", total, stock);
  const [order] = await db
    .insert(schema.orders)
    .values({
      code: "CD-TEST01",
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
  await db.insert(schema.orderItems).values({ orderId: order.id, productSlug: "celu", name: "Celu", image: "", unitPrice: total, quantity: 2 });
  await db.transaction((tx) => reserveOrderStock(tx, order.id));
  return order;
}

async function estado(id: number) {
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, id));
  const eventos = await db.select().from(schema.orderEvents).where(eq(schema.orderEvents.orderId, id));
  return { order, eventos };
}

async function stock() {
  const [row] = await db.select({ stock: schema.products.stock }).from(schema.products).where(eq(schema.products.slug, "celu"));
  return row.stock;
}

beforeEach(async () => {
  process.env.MP_WEBHOOK_SECRET = SECRET;
  await resetDb();
});
after(() => pool.end());

test("sin secreto configurado responde 500 para que Mercado Pago reintente", async () => {
  delete process.env.MP_WEBHOOK_SECRET;
  assert.equal(await enviar(aviso("1")), 500);
});

test("firma inválida responde 401 y no toca el pedido", async () => {
  const order = await crearPedido(100_000);
  pagoSimulado = { id: 1, status: "approved", external_reference: order.code, transaction_amount: 100_000 };
  assert.equal(await enviar(aviso("1", { secret: "otro" })), 401);
  assert.equal((await estado(order.id)).order.status, "pendiente_pago");
});

test("sin encabezados de firma responde 400", async () => {
  const req = new Request("http://localhost:3000/api/webhooks/mercadopago", { method: "POST", body: "{}" });
  assert.equal(await enviar(req), 400);
});

test("pago aprobado por el total exacto acredita el pedido", async () => {
  const order = await crearPedido(100_000);
  pagoSimulado = { id: 555, status: "approved", external_reference: order.code.toLowerCase(), transaction_amount: 100_000 };
  assert.equal(await enviar(aviso("555")), 200);
  const { order: despues } = await estado(order.id);
  assert.equal(despues.status, "pago_confirmado");
  assert.equal(despues.mercadopagoPaymentId, "555");
});

test("pago aprobado por otro monto deja el pedido pendiente con una nota", async () => {
  const order = await crearPedido(100_000);
  pagoSimulado = { id: 556, status: "approved", external_reference: order.code, transaction_amount: 90_000 };
  assert.equal(await enviar(aviso("556")), 200);
  const { order: despues, eventos } = await estado(order.id);
  assert.equal(despues.status, "pendiente_pago");
  assert.match(eventos.at(-1)?.note ?? "", /Revisar antes de despachar/);
});

test("el mismo aviso dos veces no acredita dos veces", async () => {
  const order = await crearPedido(100_000);
  pagoSimulado = { id: 557, status: "approved", external_reference: order.code, transaction_amount: 100_000 };
  await enviar(aviso("557"));
  await enviar(aviso("557"));
  const { eventos } = await estado(order.id);
  assert.equal(eventos.filter((e) => e.toStatus === "pago_confirmado" && e.fromStatus !== e.toStatus).length, 1);
});

test("un reembolso del pago que acreditó cancela el pedido y devuelve el stock", async () => {
  const order = await crearPedido(100_000);
  assert.equal(await stock(), 8);
  pagoSimulado = { id: 558, status: "approved", external_reference: order.code, transaction_amount: 100_000 };
  await enviar(aviso("558"));
  pagoSimulado = { ...pagoSimulado, status: "refunded" };
  await enviar(aviso("558"));
  assert.equal((await estado(order.id)).order.status, "cancelado");
  assert.equal(await stock(), 10);
});

test("un reembolso de otro pago no cancela nada", async () => {
  const order = await crearPedido(100_000);
  pagoSimulado = { id: 559, status: "approved", external_reference: order.code, transaction_amount: 100_000 };
  await enviar(aviso("559"));
  pagoSimulado = { id: 999, status: "refunded", external_reference: order.code, transaction_amount: 100_000 };
  await enviar(aviso("999"));
  assert.equal((await estado(order.id)).order.status, "pago_confirmado");
});

test("un pago que no es de Mercado Pago no se acredita por este camino", async () => {
  const order = await crearPedido(100_000);
  await db.update(schema.orders).set({ paymentMethod: "transferencia" }).where(eq(schema.orders.id, order.id));
  pagoSimulado = { id: 560, status: "approved", external_reference: order.code, transaction_amount: 100_000 };
  await enviar(aviso("560"));
  assert.equal((await estado(order.id)).order.status, "pendiente_pago");
});
