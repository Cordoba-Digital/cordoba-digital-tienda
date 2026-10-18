import { sessionFromCookieHeader } from "@/lib/admin-auth";
import { verifyAdminSessionValue } from "@/lib/admin-session";
import { measurePhotosBatch, photoCheckStatus } from "@/lib/photo-checks";

export const dynamic = "force-dynamic";
// Cada tanda mide ~40 s y el panel pide la siguiente hasta terminar.
export const maxDuration = 60;

async function authorized(request: Request): Promise<boolean> {
  return !!(await verifyAdminSessionValue(sessionFromCookieHeader(request.headers.get("cookie"))));
}

/** Resumen: sin foto, chicas, marcadas y sin medir. */
export async function GET(request: Request) {
  if (!(await authorized(request))) return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  return Response.json({ ok: true, ...(await photoCheckStatus()) });
}

/** Mide una tanda. Body: `{ skip?: number[] }` (productos que ya fallaron en esta corrida). */
export async function POST(request: Request) {
  if (!(await authorized(request))) return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { skip?: unknown };
  const skip = Array.isArray(body.skip) ? body.skip.filter((n): n is number => Number.isInteger(n)).slice(0, 10_000) : [];
  try {
    return Response.json({ ok: true, ...(await measurePhotosBatch({ timeBudgetMs: 40_000, skip })) });
  } catch (error) {
    console.error("[fotos-revision] no se pudo medir", error);
    return Response.json({ ok: false, error: "No se pudieron medir las fotos." }, { status: 500 });
  }
}
