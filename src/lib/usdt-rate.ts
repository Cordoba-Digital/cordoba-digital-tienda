import { eq } from "drizzle-orm";

import { db } from "@/db";
import { storeSettings } from "@/db/schema";
import { ensureSettingsSchema } from "@/lib/automations";

/**
 * Cotización para pasar el total en pesos a USDT: pesos por USDT, la que
 * carga el dueño en Admin → Medios de pago (Ronan, 19/10: como en WordPress,
 * un valor que fija la tienda y no el dólar oficial del día). Sin cotización
 * cargada, el checkout no ofrece USDT.
 */
const KEY = "cotizacion.usdt_tienda";
/** Fuera de este rango es un error de tipeo, no un precio. */
export const USDT_RATE_MIN = 100;
export const USDT_RATE_MAX = 100_000;

export type UsdtRate = { rate: number; updatedAt: string; source: string };
export type SavedUsdtRate = UsdtRate & { updatedBy: string };

const SOURCE = "Cotización de la tienda";

export function isValidUsdtRate(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= USDT_RATE_MIN && value <= USDT_RATE_MAX;
}

export async function getSavedUsdtRate(): Promise<SavedUsdtRate | null> {
  await ensureSettingsSchema();
  const [row] = await db
    .select({ value: storeSettings.value, updatedBy: storeSettings.updatedBy, updatedAt: storeSettings.updatedAt })
    .from(storeSettings)
    .where(eq(storeSettings.key, KEY))
    .limit(1);
  const rate = (row?.value as { rate?: unknown } | undefined)?.rate;
  if (!row || !isValidUsdtRate(rate)) return null;
  return { rate, updatedAt: row.updatedAt.toISOString(), source: SOURCE, updatedBy: row.updatedBy };
}

/** La cotización con la que se cobra, o null (USDT apagado). Si la base falla, USDT se apaga en vez de romper el checkout. */
export async function getUsdtRate(): Promise<UsdtRate | null> {
  try {
    const saved = await getSavedUsdtRate();
    return saved ? { rate: saved.rate, updatedAt: saved.updatedAt, source: saved.source } : null;
  } catch (error) {
    console.error("[usdt] no se pudo leer la cotización:", error);
    return null;
  }
}

/** Guarda la cotización (o la borra con null). Devuelve la anterior (null si no había). */
export async function saveUsdtRate(rate: number | null, actor: string): Promise<number | null> {
  const before = (await getSavedUsdtRate())?.rate ?? null;
  if (rate === null) {
    await db.delete(storeSettings).where(eq(storeSettings.key, KEY));
    return before;
  }
  await db
    .insert(storeSettings)
    .values({ key: KEY, value: { rate }, updatedBy: actor })
    .onConflictDoUpdate({ target: storeSettings.key, set: { value: { rate }, updatedBy: actor, updatedAt: new Date() } });
  return before;
}
