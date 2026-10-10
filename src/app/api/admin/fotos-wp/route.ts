import { logAdminAction, actorFromRequest } from "@/lib/admin-audit";
import { sessionFromCookieHeader } from "@/lib/admin-auth";
import { verifyAdminSessionValue } from "@/lib/admin-session";
import { migrateWpImages, wpImageStatus } from "@/lib/wp-image-migration";

export const dynamic = "force-dynamic";
// Cada tanda trabaja ~40 s y el panel pide la siguiente hasta terminar.
export const maxDuration = 60;

async function authorized(request: Request): Promise<boolean> {
  return !!(await verifyAdminSessionValue(sessionFromCookieHeader(request.headers.get("cookie"))));
}

/** Cuántos productos siguen con fotos del WordPress. */
export async function GET(request: Request) {
  if (!(await authorized(request))) return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  return Response.json({ ok: true, ...(await wpImageStatus()) });
}

/** Copia una tanda. Body: `{ skip?: number[] }` (productos que ya fallaron en esta corrida). */
export async function POST(request: Request) {
  if (!(await authorized(request))) return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { skip?: unknown };
  const skip = Array.isArray(body.skip) ? body.skip.filter((n): n is number => Number.isInteger(n)).slice(0, 10_000) : [];
  try {
    const batch = await migrateWpImages({ timeBudgetMs: 40_000, skip });
    if (batch.copied) {
      await logAdminAction(await actorFromRequest(request), {
        action: "copiar fotos",
        entityType: "producto",
        entityId: "wordpress",
        summary: `Copió ${batch.copied} fotos del WordPress (${batch.products} productos)`,
      });
    }
    return Response.json({ ok: true, ...batch });
  } catch (error) {
    return Response.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}
