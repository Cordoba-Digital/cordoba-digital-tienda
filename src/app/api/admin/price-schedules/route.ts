import { sessionFromCookieHeader } from "@/lib/admin-auth";
import { actorFromRequest, logAdminAction } from "@/lib/admin-audit";
import { verifyAdminSessionValue } from "@/lib/admin-session";
import { formatDateTime, money } from "@/lib/format";
import { applyDuePriceSchedules, createPriceSchedule, type PriceScheduleInput } from "@/lib/price-schedules";
import { refreshStorePages } from "@/lib/store-cache";

export const dynamic = "force-dynamic";

async function authorized(request: Request): Promise<boolean> {
  return verifyAdminSessionValue(sessionFromCookieHeader(request.headers.get("cookie")));
}

export async function POST(request: Request) {
  if (!(await authorized(request))) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  const actor = await actorFromRequest(request);
  const body = ((await request.json().catch(() => ({}))) ?? {}) as PriceScheduleInput;
  const result = await createPriceSchedule(body, actor);
  if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: 400 });

  const { schedule } = result;
  await logAdminAction(actor, {
    action: "alta",
    entityType: "oferta",
    entityId: schedule.productSlug,
    summary: `Programó ${schedule.productSlug} a ${money(schedule.offerPrice)} del ${formatDateTime(schedule.startsAt)} al ${formatDateTime(schedule.endsAt)}`,
  });
  // Si el inicio ya pasó, empieza ahora mismo.
  // La ficha muestra la cantidad real de los productos con oferta programada.
  const { changed } = await applyDuePriceSchedules();
  refreshStorePages([schedule.productSlug, ...changed]);
  return Response.json({ ok: true, schedule });
}
