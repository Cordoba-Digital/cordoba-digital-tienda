import { sincronizarEnvios } from "@/lib/admin-andreani";
import { andreaniConfigurado } from "@/lib/andreani";
import { expireStalePendingOrders } from "@/lib/order-status";

export const dynamic = "force-dynamic";

/**
 * Cron diario de Vercel (`vercel.json`): cancela los pedidos que siguen sin
 * pago pasadas las horas de reserva y devuelve su stock. Vercel manda
 * `Authorization: Bearer $CRON_SECRET`; sin esa variable el endpoint no corre
 * (el panel igual vence los pedidos cada vez que se abre).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  const expired = await expireStalePendingOrders();
  // De paso trae de Andreani los números de seguimiento y estados nuevos. El
  // panel también lo hace a pedido con "Actualizar seguimiento".
  let andreani: { revisados: number; actualizados: number } | { error: string } | null = null;
  if (andreaniConfigurado()) {
    andreani = await sincronizarEnvios().catch((error: unknown) => ({
      error: error instanceof Error ? error.message : "error inesperado",
    }));
  }
  return Response.json({ ok: true, expired, andreani });
}
