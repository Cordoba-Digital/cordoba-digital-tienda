import { applyDuePriceSchedules, nextPriceChangeAt } from "@/lib/price-schedules";
import { refreshStorePages } from "@/lib/store-cache";

export const dynamic = "force-dynamic";

/**
 * Empieza o termina las ofertas programadas cuya hora llegó y refresca las
 * páginas en caché de esos productos. Público a propósito: solo hace lo que
 * ya está programado, nunca antes de hora, así que llamarlo de más no cambia
 * nada. Lo piden la tienda abierta (`PriceScheduleTicker`), el monitoreo de
 * GitHub y el cron diario.
 */
export async function POST() {
  const { changed } = await applyDuePriceSchedules();
  if (changed.length) refreshStorePages(changed);
  const next = await nextPriceChangeAt();
  return Response.json({ ok: true, changed: changed.length, next: next?.toISOString() ?? null });
}
