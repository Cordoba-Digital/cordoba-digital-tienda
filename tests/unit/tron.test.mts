import assert from "node:assert/strict";
import { test } from "node:test";

import { findUsdtTransfer, formatTokenAmount, isTronAddress, normalizeTxid, USDT_TRC20_CONTRACT } from "../../src/lib/tron.ts";

// Dirección pública (el contrato de USDT), no la wallet de la tienda: el repo es público.
const WALLET = USDT_TRC20_CONTRACT;
const TXID = "a".repeat(64);

test("isTronAddress acepta una dirección real y rechaza un carácter mal copiado", () => {
  assert.equal(isTronAddress(WALLET), true);
  assert.equal(isTronAddress(`${WALLET.slice(0, -1)}u`), false);
  assert.equal(isTronAddress("0x1234"), false);
  assert.equal(isTronAddress(""), false);
  // Dirección de Bitcoin: base58 válido pero no es de TRON.
  assert.equal(isTronAddress("1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2"), false);
});

test("normalizeTxid pide 64 hexadecimales y los pasa a minúsculas", () => {
  assert.equal(normalizeTxid(` ${"AB".repeat(32)} `), "ab".repeat(32));
  assert.equal(normalizeTxid("ab".repeat(31)), null);
  assert.equal(normalizeTxid(`${"a".repeat(63)}z`), null);
  assert.equal(normalizeTxid(123), null);
});

test("formatTokenAmount convierte las unidades de USDT sin redondeos", () => {
  assert.equal(formatTokenAmount("150500000", 6), "150.5");
  assert.equal(formatTokenAmount("1000000", 6), "1");
  assert.equal(formatTokenAmount("1", 6), "0.000001");
  assert.equal(formatTokenAmount("x", 6), "0");
});

function respuesta(data: unknown[], next?: string) {
  return new Response(JSON.stringify({ data, meta: next ? { links: { next } } : {} }), { status: 200 });
}

const transferencia = {
  transaction_id: TXID,
  from: "TFromCliente",
  to: WALLET,
  type: "Transfer",
  value: "25000000",
  block_timestamp: Date.UTC(2026, 9, 19, 12),
  token_info: { address: USDT_TRC20_CONTRACT, decimals: 6 },
};

test("findUsdtTransfer encuentra el TXID en la wallet, aunque esté en la segunda página", async () => {
  const urls: string[] = [];
  const fake = (async (url: string) => {
    urls.push(url);
    return urls.length === 1 ? respuesta([{ ...transferencia, transaction_id: "b".repeat(64) }], "https://api.trongrid.io/next") : respuesta([transferencia]);
  }) as typeof fetch;
  const found = await findUsdtTransfer({ wallet: WALLET, txid: TXID, since: new Date() }, fake);
  assert.deepEqual(found, { amount: "25", from: "TFromCliente", at: "2026-10-19T12:00:00.000Z" });
  assert.match(urls[0], /only_to=true/);
  assert.match(urls[0], /only_confirmed=true/);
  assert.match(urls[0], new RegExp(`contract_address=${USDT_TRC20_CONTRACT}`));
});

test("findUsdtTransfer no cuenta otra moneda, otra wallet ni un next fuera de TronGrid", async () => {
  const otraMoneda = (async () => respuesta([{ ...transferencia, token_info: { address: "TOtroToken", decimals: 6 } }])) as typeof fetch;
  assert.equal(await findUsdtTransfer({ wallet: WALLET, txid: TXID, since: new Date() }, otraMoneda), null);
  const otraWallet = (async () => respuesta([{ ...transferencia, to: "TOtraWallet" }])) as typeof fetch;
  assert.equal(await findUsdtTransfer({ wallet: WALLET, txid: TXID, since: new Date() }, otraWallet), null);
  let llamadas = 0;
  const nextAjeno = (async () => {
    llamadas += 1;
    return respuesta([], "https://malicioso.example/next");
  }) as typeof fetch;
  assert.equal(await findUsdtTransfer({ wallet: WALLET, txid: TXID, since: new Date() }, nextAjeno), null);
  assert.equal(llamadas, 1);
});

test("findUsdtTransfer tira error si TronGrid falla, para no confundirlo con un pago que no llegó", async () => {
  const caido = (async () => new Response("", { status: 503 })) as typeof fetch;
  await assert.rejects(findUsdtTransfer({ wallet: WALLET, txid: TXID, since: new Date() }, caido), /503/);
});
