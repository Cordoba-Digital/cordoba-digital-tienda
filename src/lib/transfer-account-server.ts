import { eq } from "drizzle-orm";

import { db } from "@/db";
import { storeSettings } from "@/db/schema";
import { ensureSettingsSchema } from "@/lib/automations";
import {
  accountFromInput,
  transferAccount,
  validateTransferInput,
  type TransferAccount,
  type TransferAccountInput,
} from "@/lib/transfer-account";

/**
 * Cuenta de cobro editable desde Admin → Medios de pago. Se guarda en
 * `store_settings` (nunca en el código: el repo es público). Si nadie la cargó
 * todavía, valen las variables `TRANSFER_*` de Vercel, como antes.
 */
const KEY = "medios_pago.transferencia";

export type SavedTransferAccount = TransferAccountInput & { updatedBy: string; updatedAt: Date };

/** Lo guardado desde el panel, o null si nunca se cargó (o quedó algo inválido). */
export async function getSavedTransferAccount(): Promise<SavedTransferAccount | null> {
  await ensureSettingsSchema();
  const [row] = await db
    .select({ value: storeSettings.value, updatedBy: storeSettings.updatedBy, updatedAt: storeSettings.updatedAt })
    .from(storeSettings)
    .where(eq(storeSettings.key, KEY))
    .limit(1);
  if (!row) return null;
  const parsed = validateTransferInput(row.value);
  if (!parsed.ok) return null;
  return { ...parsed.value, updatedBy: row.updatedBy, updatedAt: row.updatedAt };
}

/**
 * La cuenta que ve el cliente en el checkout y en su pedido: la del panel, o
 * la de las variables si el panel está vacío. Sin caché, así un cambio vale en
 * el próximo pedido. Si la base no responde, cae a las variables en vez de
 * dejar al cliente sin datos.
 */
export async function getTransferAccount(): Promise<TransferAccount | null> {
  try {
    const saved = await getSavedTransferAccount();
    if (saved) return accountFromInput(saved);
  } catch (error) {
    console.error("[medios-de-pago] no se pudo leer la cuenta del panel:", error);
  }
  return transferAccount();
}

/** Guarda la cuenta. Devuelve lo que había antes en el panel (null si estaba vacío). */
export async function saveTransferAccount(input: TransferAccountInput, actor: string): Promise<TransferAccountInput | null> {
  const before = await getSavedTransferAccount();
  await db
    .insert(storeSettings)
    .values({ key: KEY, value: input, updatedBy: actor })
    .onConflictDoUpdate({ target: storeSettings.key, set: { value: input, updatedBy: actor, updatedAt: new Date() } });
  return before ? { number: before.number, alias: before.alias, holder: before.holder, cuit: before.cuit } : null;
}
