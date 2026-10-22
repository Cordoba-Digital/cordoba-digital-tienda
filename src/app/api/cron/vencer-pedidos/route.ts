import { sincronizarEnvios } from "@/lib/admin-andreani";
import { andreaniConfigurado } from "@/lib/andreani";
import { syncPendingMpOrders } from "@/lib/checkout-mp-sync";
import { purgeExpiredContactData } from "@/lib/data-retention";
import { expireStalePendingOrders } from "@/lib/order-status";
import { applyDuePriceSchedules } from "@/lib/price-schedules";
import { refreshStorePages } from "@/lib/store-cache";

export const dynamic = "force-dynamic";

/**
 * Cron diario de Vercel (`vercel.json`): cancela los pedidos que siguen sin
 * pago pasadas las horas de reserva y devuelve su stock, y borra los datos de
 * contacto vencidos (ver `data-retention.ts`). Vercel manda
 * `Authorization: Bearer $CRON_SECRET`; sin esa variable el endpoint no corre
 * (el panel igual vence los pedidos cada vez que se abre).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  // Antes de vencer, se acreditan los pedidos de Mercado Pago que se cobraron
  // pero cuyo aviso no llegó: si no, se cancelaría un pedido pagado.
  const mercadoPago = await syncPendingMpOrders().catch((error: unknown) => ({
    error: error instanceof Error ? error.message : "error inesperado",
  }));
  const expired = await expireStalePendingOrders();
  // Respaldo de las ofertas programadas, por si nadie pasó por la tienda.
  const ofertas = await applyDuePriceSchedules()
    .then(({ changed }) => {
      if (changed.length) refreshStorePages(changed);
      return { cambiadas: changed.length };
    })
    .catch((error: unknown) => ({ error: error instanceof Error ? error.message : "error inesperado" }));
  // De paso trae de Andreani los números de seguimiento y estados nuevos. El
  // panel también lo hace a pedido con "Actualizar seguimiento".
  let andreani: { revisados: number; actualizados: number } | { error: string } | null = null;
  if (andreaniConfigurado()) {
    andreani = await sincronizarEnvios().catch((error: unknown) => ({
      error: error instanceof Error ? error.message : "error inesperado",
    }));
  }
  // Teléfono, DNI y dirección de pedidos cerrados hace más de dos años.
  const datosVencidos = await purgeExpiredContactData().catch((error: unknown) => ({
    error: error instanceof Error ? error.message : "error inesperado",
  }));
  return Response.json({ ok: true, expired, mercadoPago, andreani, datosVencidos, ofertas });
}
