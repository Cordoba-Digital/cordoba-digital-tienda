import { sessionFromCookieHeader } from "@/lib/admin-auth";
import { actorFromRequest, logAdminAction } from "@/lib/admin-audit";
import { verifyAdminSessionValue } from "@/lib/admin-session";
import { cancelPriceSchedule } from "@/lib/price-schedules";
import { refreshStorePages } from "@/lib/store-cache";

export const dynamic = "force-dynamic";

/** Cancela una oferta programada, o termina ya una que está corriendo. */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await verifyAdminSessionValue(sessionFromCookieHeader(request.headers.get("cookie"))))) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  const id = Number((await context.params).id);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ ok: false, error: "Oferta inexistente." }, { status: 404 });
  const result = await cancelPriceSchedule(id);
  if (!result) return Response.json({ ok: false, error: "Oferta inexistente." }, { status: 404 });
  refreshStorePages([result.slug]);
  await logAdminAction(await actorFromRequest(request), {
    action: "baja",
    entityType: "oferta",
    entityId: result.slug,
    summary: result.restored ? `Terminó antes de hora la oferta de ${result.slug}` : `Canceló la oferta programada de ${result.slug}`,
  });
  return Response.json({ ok: true });
}
