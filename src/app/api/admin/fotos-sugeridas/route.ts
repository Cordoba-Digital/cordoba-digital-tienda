import { actorFromRequest, logAdminAction } from "@/lib/admin-audit";
import { sessionFromCookieHeader } from "@/lib/admin-auth";
import { verifyAdminSessionValue } from "@/lib/admin-session";
import { decideSuggestion, MAX_EXTRAS } from "@/lib/photo-suggestions";
import { refreshStorePages } from "@/lib/store-cache";

export const dynamic = "force-dynamic";
// Bajar y convertir hasta 5 fotos puede tardar.
export const maxDuration = 60;

async function authorized(request: Request): Promise<boolean> {
  return !!(await verifyAdminSessionValue(sessionFromCookieHeader(request.headers.get("cookie"))));
}

/** "Usar" o "Descartar". Body: `{ slug, image, action: "usar" | "descartar", extras?: string[] }`. */
export async function POST(request: Request) {
  if (!(await authorized(request))) return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { slug?: unknown; image?: unknown; action?: unknown; extras?: unknown };
  const extras = body.extras ?? [];
  if (
    typeof body.slug !== "string" ||
    typeof body.image !== "string" ||
    (body.action !== "usar" && body.action !== "descartar") ||
    !Array.isArray(extras) ||
    extras.length > MAX_EXTRAS ||
    !extras.every((e) => typeof e === "string")
  ) {
    return Response.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  }
  const result = await decideSuggestion({ slug: body.slug, image: body.image, action: body.action, extras });
  if (!result.ok) return Response.json(result, { status: 400 });
  await logAdminAction(await actorFromRequest(request), {
    action: body.action === "usar" ? "foto sugerida" : "descartar foto sugerida",
    entityType: "producto",
    entityId: result.slug,
    summary: `${result.name}: ${
      body.action === "usar"
        ? result.added && result.added > 1
          ? `usó ${result.added} fotos sugeridas`
          : "usó la foto sugerida"
        : "descartó la foto sugerida"
    }`,
  });
  if (body.action === "usar") refreshStorePages([result.slug]);
  return Response.json(result);
}
