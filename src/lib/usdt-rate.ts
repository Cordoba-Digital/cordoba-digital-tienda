import { eq } from "drizzle-orm";

import { db } from "@/db";
import { storeSettings } from "@/db/schema";
import { ensureSettingsSchema } from "@/lib/automations";

/**
 * Cotización para pasar el total en pesos a USDT: el dólar oficial, precio de
 * venta, del día (DolarApi, que publica el de los bancos autorizados por el
 * BCRA). 1 USDT se toma como 1 dólar.
 *
 * Se guarda en memoria unos minutos y la última buena queda en
 * `store_settings`: si la API no responde, se usa esa. El oficial no se mueve
 * los fines de semana ni feriados, así que se acepta hasta 4 días de
 * antigüedad (un fin de semana largo); más vieja, el checkout no ofrece USDT
 * en vez de cobrar con un número viejo.
 */
export const USDT_RATE_URL = "https://dolarapi.com/v1/dolares/oficial";
const KEY = "cotizacion.usdt";
const MEMORY_MS = 10 * 60 * 1000;
const MAX_AGE_MS = 4 * 24 * 60 * 60 * 1000;

export type UsdtRate = { rate: number; updatedAt: string; source: string };

const SOURCE = "Dólar oficial (venta)";
let memory: { value: UsdtRate; at: number } | null = null;

/** Solo para tests: olvida lo guardado en memoria. */
export function resetUsdtRateCache(): void {
  memory = null;
}

function parse(body: unknown): UsdtRate | null {
  const data = body as { venta?: unknown; fechaActualizacion?: unknown } | null;
  const rate = typeof data?.venta === "number" ? data.venta : Number(data?.venta);
  const updatedAt = typeof data?.fechaActualizacion === "string" ? new Date(data.fechaActualizacion) : null;
  // Un dólar oficial fuera de este rango es un error de la API, no un precio.
  if (!Number.isFinite(rate) || rate < 100 || rate > 100_000 || !updatedAt || Number.isNaN(updatedAt.getTime())) return null;
  return { rate, updatedAt: updatedAt.toISOString(), source: SOURCE };
}

async function readSaved(): Promise<UsdtRate | null> {
  await ensureSettingsSchema();
  const [row] = await db.select({ value: storeSettings.value }).from(storeSettings).where(eq(storeSettings.key, KEY)).limit(1);
  const saved = row?.value as UsdtRate | undefined;
  if (!saved || !(saved.rate > 0) || Date.now() - new Date(saved.updatedAt).getTime() > MAX_AGE_MS) return null;
  return saved;
}

export async function getUsdtRate(fetchImpl: typeof fetch = fetch): Promise<UsdtRate | null> {
  if (memory && Date.now() - memory.at < MEMORY_MS) return memory.value;
  try {
    const res = await fetchImpl(USDT_RATE_URL, { headers: { accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(5000) });
    const fresh = res.ok ? parse(await res.json()) : null;
    if (fresh && Date.now() - new Date(fresh.updatedAt).getTime() <= MAX_AGE_MS) {
      memory = { value: fresh, at: Date.now() };
      await ensureSettingsSchema();
      await db
        .insert(storeSettings)
        .values({ key: KEY, value: fresh, updatedBy: "sistema" })
        .onConflictDoUpdate({ target: storeSettings.key, set: { value: fresh, updatedBy: "sistema", updatedAt: new Date() } })
        .catch((error) => console.error("[usdt] no se pudo guardar la cotización:", error));
      return fresh;
    }
    console.warn(`[usdt] la cotización no vino bien (HTTP ${res.status}); se usa la última guardada`);
  } catch (error) {
    console.warn("[usdt] no se pudo consultar la cotización; se usa la última guardada:", error instanceof Error ? error.message : error);
  }
  return readSaved().catch(() => null);
}
