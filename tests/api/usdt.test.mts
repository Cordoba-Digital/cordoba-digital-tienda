/**
 * USDT por red TRON: la wallet se carga desde Medios de pago (solo dueños), el
 * checkout ofrece USDT solo con wallet y fija el monto exacto con el dólar
 * oficial, el cliente pega el TXID en su pedido y, si en la red llegó el monto
 * completo, el pedido pasa solo a pagado.
 *
 * Uso: npm run test:api (necesita Postgres local migrado en DATABASE_URL)
 */
import assert from "node:assert/strict";
import { after, afterEach, beforeEach, test } from "node:test";

import { eq, sql } from "drizzle-orm";

import { comprador, db, domicilio, pool, post, resetDb, schema, seedProduct } from "./db.mts";

process.env.ADMIN_PASSWORD = "clave-de-prueba";
process.env.ADMIN_EMAILS = "duenio@example.com";
delete process.env.MP_ACCESS_TOKEN;

const { PUT: guardarWallet } = await import("../../src/app/api/admin/payment-methods/usdt/route");
const { POST: checkoutPost } = await import("../../src/app/api/checkout/route");
const { POST: cargarTxid } = await import("../../src/app/api/orders/[code]/usdt/route");
const { createAdminSessionValue } = await import("../../src/lib/admin-auth");
const { addAdminAccess } = await import("../../src/lib/admin-access");
const { captureMailForTests } = await import("../../src/lib/mailer");
const { expireStalePendingOrders } = await import("../../src/lib/order-status");
const { USDT_TRC20_CONTRACT } = await import("../../src/lib/tron");
const { usdtAmountFor } = await import("../../src/lib/usdt-amount");
const { PUT: guardarCotizacion } = await import("../../src/app/api/admin/payment-methods/usdt-rate/route");

const BASE = "http://localhost:3000";
// Dirección pública (el contrato de USDT), no la wallet de la tienda: el repo es público.
const WALLET = USDT_TRC20_CONTRACT;
const TXID = "c".repeat(64);
const enviados = captureMailForTests();
const realFetch = globalThis.fetch;

async function cookie(email: string): Promise<string> {
  return `admin_session=${encodeURIComponent((await createAdminSessionValue(email))!)}`;
}

function putWallet(wallet: unknown, cookieHeader: string): Request {
  return new Request(`${BASE}/api/admin/payment-methods/usdt`, {
    method: "PUT",
    headers: { "content-type": "application/json", cookie: cookieHeader, origin: BASE },
    body: JSON.stringify({ wallet }),
  });
}

function putRate(rate: unknown, cookieHeader: string): Request {
  return new Request(`${BASE}/api/admin/payment-methods/usdt-rate`, {
    method: "PUT",
    headers: { "content-type": "application/json", cookie: cookieHeader, origin: BASE },
    body: JSON.stringify({ rate }),
  });
}

/** Wallet y cotización cargadas por el dueño: USDT listo para cobrar. */
async function prenderUsdt(): Promise<void> {
  const duenio = await cookie("duenio@example.com");
  assert.equal((await guardarWallet(putWallet(WALLET, duenio))).status, 200);
  assert.equal((await guardarCotizacion(putRate(COTIZACION, duenio))).status, 200);
}

async function comprarConUsdt() {
  const res = await checkoutPost(
    post("/api/checkout", { customer: comprador, delivery: domicilio, payment: { method: "usdt" }, items: [{ slug: "celu", quantity: 1 }] }),
  );
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

function txid(code: string, value: string) {
  return cargarTxid(post(`/api/orders/${code}/usdt`, { txid: value }), { params: Promise.resolve({ code }) });
}

const COTIZACION = 1_570;
/** USDT que aparecen en la wallet (null: todavía no llegó nada). */
let llego: string | null = null;
function redFalsa() {
  globalThis.fetch = (async (url: string | URL | Request) => {
    const href = String(url);
    assert.match(href, /^https:\/\/api\.trongrid\.io\//);
    const data = llego
      ? [
          {
            transaction_id: TXID,
            from: "TCliente",
            to: WALLET,
            type: "Transfer",
            value: String(Math.round(Number(llego) * 1_000_000)),
            block_timestamp: Date.now(),
            token_info: { address: USDT_TRC20_CONTRACT, decimals: 6 },
          },
        ]
      : [];
    return new Response(JSON.stringify({ data, meta: {} }), { status: 200 });
  }) as typeof fetch;
}

async function pedidoPorCodigo(code: string) {
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.code, code));
  const [pago] = await db.select().from(schema.usdtPayments).where(eq(schema.usdtPayments.orderId, order.id));
  return { order, pago };
}

beforeEach(async () => {
  await resetDb();
  await db.execute(sql`truncate table admin_audit`).catch(() => undefined);
  await seedProduct("celu", 100_000, 10);
  enviados.length = 0;
  llego = null;
  redFalsa();
});
afterEach(() => {
  globalThis.fetch = realFetch;
});
after(() => pool.end());

test("sin wallet cargada, el checkout no acepta USDT", async () => {
  const res = await comprarConUsdt();
  assert.equal(res.status, 400);
  assert.match(JSON.stringify(res.body), /no está disponible/);
});

test("solo un dueño carga la wallet, se valida y queda en Actividad con aviso", async () => {
  await addAdminAccess("empleado@example.com", "duenio@example.com");
  assert.equal((await guardarWallet(putWallet(WALLET, await cookie("empleado@example.com")))).status, 403);
  assert.equal((await guardarWallet(putWallet(WALLET, ""))).status, 401);
  assert.equal((await guardarWallet(putWallet(`${WALLET.slice(0, -1)}u`, await cookie("duenio@example.com")))).status, 400);

  const res = await guardarWallet(putWallet(WALLET, await cookie("duenio@example.com")));
  assert.equal(res.status, 200, await res.clone().text());
  const audit = await db.execute(sql`select action, entity_id from admin_audit`);
  assert.deepEqual(audit.rows, [{ action: "wallet_usdt", entity_id: "usdt" }]);
  assert.equal(enviados.length, 1);
  assert.match(enviados[0].text ?? "", new RegExp(WALLET));
});

test("el pedido fija el monto exacto en USDT con la cotización de la tienda", async () => {
  await prenderUsdt();
  const compra = await comprarConUsdt();
  assert.equal(compra.status, 200, JSON.stringify(compra.body));
  const { order, pago } = await pedidoPorCodigo(compra.body.code as string);
  assert.equal(pago.expectedAmount, usdtAmountFor(order.total, COTIZACION));
  assert.equal(pago.rate, String(COTIZACION));
  assert.equal(pago.txid, null);
});

test("con wallet pero sin cotización no se cobra en USDT", async () => {
  await guardarWallet(putWallet(WALLET, await cookie("duenio@example.com")));
  const res = await comprarConUsdt();
  assert.equal(res.status, 400);
  assert.match(JSON.stringify(res.body), /USDT no está disponible/);
  assert.equal((await db.select().from(schema.orders)).length, 0);
});

test("solo un dueño cambia la cotización, se valida y queda en Actividad con aviso", async () => {
  await addAdminAccess("empleado@example.com", "duenio@example.com");
  assert.equal((await guardarCotizacion(putRate(COTIZACION, await cookie("empleado@example.com")))).status, 403);
  assert.equal((await guardarCotizacion(putRate(COTIZACION, ""))).status, 401);
  for (const malo of [0, 99, 1570.5, "1570", 200_000]) {
    assert.equal((await guardarCotizacion(putRate(malo, await cookie("duenio@example.com")))).status, 400, String(malo));
  }
  const res = await guardarCotizacion(putRate(COTIZACION, await cookie("duenio@example.com")));
  assert.equal(res.status, 200, await res.clone().text());
  const audit = await db.execute(sql`select action, summary from admin_audit`);
  assert.deepEqual(audit.rows, [{ action: "cotizacion_usdt", summary: "Cambió la cotización de USDT a $1.570" }]);
  assert.equal(enviados.length, 1);
  assert.match(enviados[0].text ?? "", /\$1\.570/);
});

test("cambiar la cotización no cambia lo que debe un pedido ya hecho", async () => {
  await prenderUsdt();
  const code = (await comprarConUsdt()).body.code as string;
  const antes = (await pedidoPorCodigo(code)).pago.expectedAmount;
  await guardarCotizacion(putRate(2_000, await cookie("duenio@example.com")));
  assert.equal((await pedidoPorCodigo(code)).pago.expectedAmount, antes);
});

test("si llega el monto completo, el pedido pasa solo a pagado y avisa a la tienda", async () => {
  await prenderUsdt();
  enviados.length = 0;
  const code = (await comprarConUsdt()).body.code as string;
  const esperado = (await pedidoPorCodigo(code)).pago.expectedAmount;

  assert.equal((await txid(code, "no-es-un-txid")).status, 400);

  // Todavía no aparece: queda guardado sin verificar.
  let res = await txid(code, TXID.toUpperCase());
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, verified: false, amount: null });
  assert.equal(enviados.filter((m) => m.to === "consultas@cordobadigital.net").length, 0);

  llego = esperado;
  res = await txid(code, TXID);
  assert.deepEqual(await res.json(), { ok: true, verified: true, amount: String(Number(esperado)) });
  const { order, pago } = await pedidoPorCodigo(code);
  assert.equal(order.status, "pago_confirmado");
  assert.ok(pago.verifiedAt);
  assert.ok(enviados.some((m) => /acreditado/.test(m.subject ?? "") && new RegExp(code).test(m.subject ?? "")));

  // Ya pagado, no acepta otro TXID.
  assert.equal((await txid(code, "d".repeat(64))).status, 409);
});

test("si llega de menos, queda pendiente con lo que falta y avisa a la tienda", async () => {
  await prenderUsdt();
  enviados.length = 0;
  const code = (await comprarConUsdt()).body.code as string;
  const esperado = (await pedidoPorCodigo(code)).pago.expectedAmount;
  llego = (Number(esperado) - 1).toFixed(2);
  await txid(code, TXID);
  const { order, pago } = await pedidoPorCodigo(code);
  assert.equal(order.status, "pendiente_pago");
  assert.ok(pago.verifiedAt);
  const notas = await db.select({ note: schema.orderEvents.note }).from(schema.orderEvents).where(eq(schema.orderEvents.orderId, order.id));
  assert.ok(notas.some((n) => /faltan 1 USDT/.test(n.note)), JSON.stringify(notas));
  assert.ok(enviados.some((m) => /incompleto/.test(m.subject ?? "")));
});

test("un TXID no paga dos pedidos", async () => {
  await prenderUsdt();
  const a = (await comprarConUsdt()).body.code as string;
  const b = (await comprarConUsdt()).body.code as string;
  assert.equal((await txid(a, TXID)).status, 200);
  const res = await txid(b, TXID);
  assert.equal(res.status, 409);
  assert.match(((await res.json()) as { error: string }).error, /otro pedido/);
});

test("un pedido en USDT con TXID cargado no vence solo; uno sin TXID sí", async () => {
  await prenderUsdt();
  const conTxid = (await comprarConUsdt()).body.code as string;
  const sinTxid = (await comprarConUsdt()).body.code as string;
  await txid(conTxid, TXID);
  await db.execute(sql`update orders set created_at = now() - interval '72 hours'`);
  assert.equal(await expireStalePendingOrders(), 1);
  const estados = await db.select({ code: schema.orders.code, status: schema.orders.status }).from(schema.orders);
  const por = Object.fromEntries(estados.map((o) => [o.code, o.status]));
  assert.equal(por[conTxid], "pendiente_pago");
  assert.equal(por[sinTxid], "cancelado");
});

test("un pedido que no es en USDT no acepta TXID", async () => {
  const res = await checkoutPost(
    post("/api/checkout", { customer: comprador, delivery: domicilio, payment: { method: "transferencia" }, items: [{ slug: "celu", quantity: 1 }] }),
  );
  const code = ((await res.json()) as { code: string }).code;
  assert.equal((await txid(code, TXID)).status, 400);
});
