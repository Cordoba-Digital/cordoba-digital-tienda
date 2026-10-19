import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { orderEvents, storeSettings, usdtPayments } from "@/db/schema";
import { ensureSettingsSchema } from "@/lib/automations";
import { mailConfigured, sendMail, STORE_EMAIL } from "@/lib/mailer";
import { applyOrderStatus } from "@/lib/order-status";
import { findUsdtTransfer, isTronAddress, tronscanTxUrl, type UsdtTransfer } from "@/lib/tron";
import { usdtShortfall } from "@/lib/usdt-amount";
import type { UsdtRate } from "@/lib/usdt-rate";
import { ensureUsdtSchema } from "@/lib/usdt-schema";

/**
 * Wallet de USDT (red TRON) editable desde Admin → Medios de pago. Como la
 * cuenta para transferir, se guarda en `store_settings` y nunca en el código
 * (el repo es público). Sin wallet cargada, el checkout no ofrece USDT.
 */
const KEY = "medios_pago.usdt";

export type SavedUsdtWallet = { wallet: string; updatedBy: string; updatedAt: Date };

export async function getSavedUsdtWallet(): Promise<SavedUsdtWallet | null> {
  await ensureSettingsSchema();
  const [row] = await db
    .select({ value: storeSettings.value, updatedBy: storeSettings.updatedBy, updatedAt: storeSettings.updatedAt })
    .from(storeSettings)
    .where(eq(storeSettings.key, KEY))
    .limit(1);
  const wallet = (row?.value as { wallet?: unknown } | undefined)?.wallet;
  if (!row || typeof wallet !== "string" || !isTronAddress(wallet)) return null;
  return { wallet, updatedBy: row.updatedBy, updatedAt: row.updatedAt };
}

/** La wallet que ve el cliente, o null (USDT apagado). Si la base falla, USDT se apaga en vez de romper el checkout. */
export async function getUsdtWallet(): Promise<string | null> {
  try {
    return (await getSavedUsdtWallet())?.wallet ?? null;
  } catch (error) {
    console.error("[medios-de-pago] no se pudo leer la wallet USDT:", error);
    return null;
  }
}

/** Guarda la wallet (o la borra con ""). Devuelve la anterior ("" si no había). */
export async function saveUsdtWallet(wallet: string, actor: string): Promise<string> {
  const before = (await getSavedUsdtWallet())?.wallet ?? "";
  if (!wallet) {
    await db.delete(storeSettings).where(eq(storeSettings.key, KEY));
    return before;
  }
  await db
    .insert(storeSettings)
    .values({ key: KEY, value: { wallet }, updatedBy: actor })
    .onConflictDoUpdate({ target: storeSettings.key, set: { value: { wallet }, updatedBy: actor, updatedAt: new Date() } });
  return before;
}

export type UsdtPayment = {
  expectedAmount: string;
  rate: string;
  rateAt: Date;
  txid: string | null;
  transfer: UsdtTransfer | null;
  verifiedAt: Date | null;
};

const COLUMNS = {
  expectedAmount: usdtPayments.expectedAmount,
  rate: usdtPayments.rate,
  rateAt: usdtPayments.rateAt,
  txid: usdtPayments.txid,
  transfer: usdtPayments.transfer,
  verifiedAt: usdtPayments.verifiedAt,
};

export async function getUsdtPayment(orderId: number): Promise<UsdtPayment | null> {
  await ensureUsdtSchema();
  const [row] = await db.select(COLUMNS).from(usdtPayments).where(eq(usdtPayments.orderId, orderId)).limit(1);
  return row ?? null;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Lo llama el checkout dentro de la transacción del pedido: fija el monto en USDT con la cotización de ese momento. */
export async function createUsdtPayment(tx: Tx, orderId: number, quote: { expectedAmount: string; rate: UsdtRate }): Promise<void> {
  await tx.insert(usdtPayments).values({
    orderId,
    expectedAmount: quote.expectedAmount,
    rate: String(quote.rate.rate),
    rateAt: new Date(quote.rate.updatedAt),
  });
}

type OrderRef = { id: number; code: string; status: string; total: number; createdAt: Date };

export type SubmitResult = { ok: true; payment: UsdtPayment } | { ok: false; error: string; status: number };

/**
 * Guarda el TXID que cargó el cliente. Mientras no se haya verificado se puede
 * corregir (un error al copiar); ya verificado, queda fijo. Un TXID que ya usó
 * otro pedido se rechaza.
 */
export async function submitUsdtTxid(order: OrderRef, txid: string): Promise<SubmitResult> {
  const current = await getUsdtPayment(order.id);
  if (!current) return { ok: false, error: "Este pedido no tiene un monto en USDT calculado. Escribinos por WhatsApp.", status: 409 };
  if (current.verifiedAt) return { ok: false, error: "Este pedido ya tiene un pago verificado.", status: 409 };
  if (current.txid === txid) return { ok: true, payment: current };
  const [taken] = await db
    .select({ orderId: usdtPayments.orderId })
    .from(usdtPayments)
    .where(eq(usdtPayments.txid, txid))
    .limit(1);
  if (taken && taken.orderId !== order.id) {
    return { ok: false, error: "Ese TXID ya se usó en otro pedido.", status: 409 };
  }
  try {
    await db.update(usdtPayments).set({ txid, transfer: null }).where(eq(usdtPayments.orderId, order.id));
  } catch {
    // Carrera con otro pedido que cargó el mismo TXID al mismo tiempo.
    return { ok: false, error: "Ese TXID ya se usó en otro pedido.", status: 409 };
  }
  await db.insert(orderEvents).values({
    orderId: order.id,
    fromStatus: order.status,
    toStatus: order.status,
    note: `El cliente cargó el TXID de USDT ${txid}.`,
  });
  return { ok: true, payment: { ...current, txid, transfer: null } };
}

/**
 * Si el pedido tiene un TXID sin verificar, lo busca en la red. Cuando aparece
 * en la wallet de la tienda lo guarda y:
 * - si llegó el monto completo, el pedido pasa solo a "Pago acreditado" (el
 *   cliente recibe el aviso como con cualquier pago);
 * - si llegó menos, queda pendiente con una nota de cuánto falta y la tienda
 *   recibe un mail para revisarlo.
 * Si TronGrid no responde, deja todo como estaba y se reintenta en la próxima
 * visita.
 */
export async function syncUsdtPayment(order: OrderRef, fetchImpl?: typeof fetch): Promise<UsdtPayment | null> {
  const payment = await getUsdtPayment(order.id);
  if (!payment?.txid || payment.verifiedAt || order.status !== "pendiente_pago") return payment;
  const wallet = await getUsdtWallet();
  if (!wallet) return payment;
  let transfer: UsdtTransfer | null;
  try {
    transfer = await findUsdtTransfer({ wallet, txid: payment.txid, since: order.createdAt }, fetchImpl);
  } catch (error) {
    console.error("[usdt] no se pudo consultar TronGrid:", error);
    return payment;
  }
  if (!transfer) return payment;

  const verifiedAt = new Date();
  const [updated] = await db
    .update(usdtPayments)
    .set({ transfer, verifiedAt })
    .where(and(eq(usdtPayments.orderId, order.id), eq(usdtPayments.txid, payment.txid), isNull(usdtPayments.verifiedAt)))
    .returning({ orderId: usdtPayments.orderId });
  // Otra visita lo verificó primero: ya anotó y avisó ella.
  if (!updated) return getUsdtPayment(order.id);

  const missing = usdtShortfall(transfer.amount, payment.expectedAmount);
  const link = tronscanTxUrl(payment.txid);
  if (missing === "0") {
    await applyOrderStatus(order.id, {
      from: "pendiente_pago",
      to: "pago_confirmado",
      note: `Pago en USDT verificado en la red: llegaron ${transfer.amount} USDT de ${payment.expectedAmount} (TXID ${payment.txid}).`,
    });
    if (mailConfigured()) {
      await sendMail({
        to: STORE_EMAIL,
        subject: `Pago en USDT acreditado: pedido ${order.code}`,
        text: [
          `Llegaron ${transfer.amount} USDT a la wallet de la tienda por el pedido ${order.code} (se esperaban ${payment.expectedAmount}).`,
          "El pedido pasó solo a Pago acreditado. Toca prepararlo.",
          "",
          `Transacción: ${link}`,
        ].join("\n"),
      }).catch((error) => console.error("[usdt] no se pudo mandar el aviso:", error));
    }
  } else {
    await db.insert(orderEvents).values({
      orderId: order.id,
      fromStatus: order.status,
      toStatus: order.status,
      note: `Llegaron ${transfer.amount} USDT de ${payment.expectedAmount}: faltan ${missing} USDT (TXID ${payment.txid}).`,
    });
    if (mailConfigured()) {
      await sendMail({
        to: STORE_EMAIL,
        subject: `Pago en USDT incompleto: pedido ${order.code}`,
        text: [
          `Llegaron ${transfer.amount} USDT por el pedido ${order.code}, pero se esperaban ${payment.expectedAmount}: faltan ${missing} USDT.`,
          "El pedido sigue pendiente. Revisalo en el panel y hablá con el cliente.",
          "",
          `Transacción: ${link}`,
        ].join("\n"),
      }).catch((error) => console.error("[usdt] no se pudo mandar el aviso:", error));
    }
  }
  return { ...payment, transfer, verifiedAt };
}
