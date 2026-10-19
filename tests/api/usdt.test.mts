/**
 * USDT por red TRON: la wallet se carga desde Medios de pago (solo dueños), el
 * checkout ofrece USDT solo con wallet, el cliente pega el TXID en su pedido,
 * se verifica contra TronGrid y la tienda recibe el aviso para aprobarlo.
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

async function comprarConUsdt() {
  const res = await checkoutPost(
    post("/api/checkout", { customer: comprador, delivery: domicilio, payment: { method: "usdt" }, items: [{ slug: "celu", quantity: 1 }] }),
  );
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

function txid(code: string, value: string) {
  return cargarTxid(post(`/api/orders/${code}/usdt`, { txid: value }), { params: Promise.resolve({ code }) });
}

/** TronGrid falso: la transferencia aparece en la wallet cuando `llego` es true. */
let llego = false;
function tronGridFalso() {
  globalThis.fetch = (async (url: string | URL | Request) => {
    assert.match(String(url), /^https:\/\/api\.trongrid\.io\//);
    const data = llego
      ? [
          {
            transaction_id: TXID,
            from: "TCliente",
            to: WALLET,
            type: "Transfer",
            value: "120500000",
            block_timestamp: Date.now(),
            token_info: { address: USDT_TRC20_CONTRACT, decimals: 6 },
          },
        ]
      : [];
    return new Response(JSON.stringify({ data, meta: {} }), { status: 200 });
  }) as typeof fetch;
}

beforeEach(async () => {
  await resetDb();
  await db.execute(sql`truncate table admin_audit`).catch(() => undefined);
  await seedProduct("celu", 100_000, 10);
  enviados.length = 0;
  llego = false;
  tronGridFalso();
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

test("el cliente paga con USDT, carga el TXID y cuando aparece en la red le llega el aviso a la tienda", async () => {
  await guardarWallet(putWallet(WALLET, await cookie("duenio@example.com")));
  enviados.length = 0;
  const compra = await comprarConUsdt();
  assert.equal(compra.status, 200, JSON.stringify(compra.body));
  const code = compra.body.code as string;

  assert.equal((await txid(code, "no-es-un-txid")).status, 400);

  // Todavía no aparece: queda guardado sin verificar.
  let res = await txid(code, TXID.toUpperCase());
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, verified: false, amount: null });
  assert.equal(enviados.length, 0);

  // Aparece en la red: se verifica, se anota y llega un solo aviso.
  llego = true;
  res = await txid(code, TXID);
  assert.deepEqual(await res.json(), { ok: true, verified: true, amount: "120.5" });
  const [pago] = await db.select().from(schema.usdtPayments);
  assert.equal(pago.txid, TXID);
  assert.equal(pago.transfer?.amount, "120.5");
  assert.ok(pago.verifiedAt);
  assert.equal(enviados.length, 1);
  assert.match(enviados[0].subject ?? "", new RegExp(code));

  // El pedido no se marca pagado solo: lo aprueba César.
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.code, code));
  assert.equal(order.status, "pendiente_pago");
  const notas = await db.select({ note: schema.orderEvents.note }).from(schema.orderEvents).where(eq(schema.orderEvents.orderId, order.id));
  assert.ok(notas.some((n) => /120\.5 USDT/.test(n.note)));

  // Ya verificado, no se puede cambiar el TXID.
  assert.equal((await txid(code, "d".repeat(64))).status, 409);
});

test("un TXID no paga dos pedidos", async () => {
  await guardarWallet(putWallet(WALLET, await cookie("duenio@example.com")));
  const a = (await comprarConUsdt()).body.code as string;
  const b = (await comprarConUsdt()).body.code as string;
  assert.equal((await txid(a, TXID)).status, 200);
  const res = await txid(b, TXID);
  assert.equal(res.status, 409);
  assert.match(((await res.json()) as { error: string }).error, /otro pedido/);
});

test("un pedido en USDT con TXID cargado no vence solo; uno sin TXID sí", async () => {
  await guardarWallet(putWallet(WALLET, await cookie("duenio@example.com")));
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
