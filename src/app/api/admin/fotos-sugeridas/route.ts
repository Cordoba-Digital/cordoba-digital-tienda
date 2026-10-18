import { actorFromRequest, logAdminAction } from "@/lib/admin-audit";
import { sessionFromCookieHeader } from "@/lib/admin-auth";
import { verifyAdminSessionValue } from "@/lib/admin-session";
import { decideSuggestion } from "@/lib/photo-suggestions";
import { refreshStorePages } from "@/lib/store-cache";

export const dynamic = "force-dynamic";

async function authorized(request: Request): Promise<boolean> {
  return !!(await verifyAdminSessionValue(sessionFromCookieHeader(request.headers.get("cookie"))));
}

/** "Usar esta foto" o "Descartar". Body: `{ slug, image, action: "usar" | "descartar" }`. */
export async function POST(request: Request) {
  if (!(await authorized(request))) return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { slug?: unknown; image?: unknown; action?: unknown };
  if (typeof body.slug !== "string" || typeof body.image !== "string" || (body.action !== "usar" && body.action !== "descartar")) {
    return Response.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  }
  const result = await decideSuggestion({ slug: body.slug, image: body.image, action: body.action });
  if (!result.ok) return Response.json(result, { status: 400 });
  await logAdminAction(await actorFromRequest(request), {
    action: body.action === "usar" ? "foto sugerida" : "descartar foto sugerida",
    entityType: "producto",
    entityId: result.slug,
    summary: `${result.name}: ${body.action === "usar" ? "usó la foto sugerida" : "descartó la foto sugerida"}`,
  });
  if (body.action === "usar") refreshStorePages([result.slug]);
  return Response.json(result);
}
