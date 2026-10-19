import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { orderEvents, storeSettings, usdtPayments } from "@/db/schema";
import { ensureSettingsSchema } from "@/lib/automations";
import { mailConfigured, sendMail, STORE_EMAIL } from "@/lib/mailer";
import { findUsdtTransfer, isTronAddress, tronscanTxUrl, type UsdtTransfer } from "@/lib/tron";

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

/**
 * Crea `usdt_payments` si falta, así el despliegue no depende de correr la
 * migración a mano (igual que `ensureOrderStockSchema`). Idempotente.
 */
let schemaReady: Promise<void> | null = null;
export function ensureUsdtSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.execute(sql`create table if not exists usdt_payments (
        order_id integer primary key not null,
        txid text not null,
        transfer jsonb,
        created_at timestamp with time zone default now() not null,
        verified_at timestamp with time zone
      )`);
      await db.execute(sql`create unique index if not exists usdt_payments_txid_idx on usdt_payments using btree (txid)`);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

export type UsdtPayment = { txid: string; transfer: UsdtTransfer | null; verifiedAt: Date | null };

export async function getUsdtPayment(orderId: number): Promise<UsdtPayment | null> {
  await ensureUsdtSchema();
  const [row] = await db
    .select({ txid: usdtPayments.txid, transfer: usdtPayments.transfer, verifiedAt: usdtPayments.verifiedAt })
    .from(usdtPayments)
    .where(eq(usdtPayments.orderId, orderId))
    .limit(1);
  return row ?? null;
}

type OrderRef = { id: number; code: string; status: string; total: number; createdAt: Date };

export type SubmitResult = { ok: true; payment: UsdtPayment } | { ok: false; error: string; status: number };

/**
 * Guarda el TXID que cargó el cliente. Mientras no se haya verificado se puede
 * corregir (un error al copiar); ya verificado, queda fijo. Un TXID que ya usó
 * otro pedido se rechaza.
 */
export async function submitUsdtTxid(order: OrderRef, txid: string): Promise<SubmitResult> {
  await ensureUsdtSchema();
  const current = await getUsdtPayment(order.id);
  if (current?.verifiedAt) {
    return { ok: false, error: "Este pedido ya tiene un pago verificado.", status: 409 };
  }
  if (current?.txid === txid) return { ok: true, payment: current };
  const [taken] = await db
    .select({ orderId: usdtPayments.orderId })
    .from(usdtPayments)
    .where(eq(usdtPayments.txid, txid))
    .limit(1);
  if (taken && taken.orderId !== order.id) {
    return { ok: false, error: "Ese TXID ya se usó en otro pedido.", status: 409 };
  }
  try {
    await db
      .insert(usdtPayments)
      .values({ orderId: order.id, txid })
      .onConflictDoUpdate({ target: usdtPayments.orderId, set: { txid, transfer: null, createdAt: new Date() } });
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
  return { ok: true, payment: { txid, transfer: null, verifiedAt: null } };
}

/**
 * Si el pedido tiene un TXID sin verificar, lo busca en la red. Cuando aparece
 * en la wallet de la tienda, lo guarda, lo anota en el pedido y avisa a la
 * casilla de la tienda para que César lo apruebe. No cambia el estado del
 * pedido: eso sigue siendo a mano. Si TronGrid no responde, deja todo como
 * estaba y se reintenta en la próxima visita.
 */
export async function syncUsdtPayment(order: OrderRef, fetchImpl?: typeof fetch): Promise<UsdtPayment | null> {
  const payment = await getUsdtPayment(order.id);
  if (!payment || payment.verifiedAt || order.status !== "pendiente_pago") return payment;
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
    .where(sql`${usdtPayments.orderId} = ${order.id} and ${usdtPayments.txid} = ${payment.txid} and ${usdtPayments.verifiedAt} is null`)
    .returning({ orderId: usdtPayments.orderId });
  // Otra visita lo verificó primero: ya anotó y avisó ella.
  if (!updated) return getUsdtPayment(order.id);

  await db.insert(orderEvents).values({
    orderId: order.id,
    fromStatus: order.status,
    toStatus: order.status,
    note: `Llegaron ${transfer.amount} USDT a la wallet (TXID ${payment.txid}). Falta aprobarlo.`,
  });
  if (mailConfigured()) {
    await sendMail({
      to: STORE_EMAIL,
      subject: `Llegó un pago en USDT del pedido ${order.code}`,
      text: [
        `Entraron ${transfer.amount} USDT a la wallet de la tienda por el pedido ${order.code}.`,
        `Total del pedido: $${order.total.toLocaleString("es-AR")}.`,
        "",
        `Transacción: ${tronscanTxUrl(payment.txid)}`,
        "",
        "Si el monto está bien, entrá al pedido en el panel y marcalo como pagado.",
      ].join("\n"),
    }).catch((error) => console.error("[usdt] no se pudo mandar el aviso:", error));
  }
  return { txid: payment.txid, transfer, verifiedAt };
}
