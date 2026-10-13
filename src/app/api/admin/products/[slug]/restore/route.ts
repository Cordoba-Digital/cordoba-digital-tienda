import { sessionFromCookieHeader } from "@/lib/admin-auth";
import { verifyAdminSessionValue } from "@/lib/admin-session";
import { actorFromRequest, logAdminAction } from "@/lib/admin-audit";
import { getAdminProductForEdit, NOT_ARCHIVED, restoreAdminProduct } from "@/lib/admin-products";
import { refreshStorePages } from "@/lib/store-cache";

export const dynamic = "force-dynamic";

/** Vuelve a publicar un producto archivado. */
export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  if (!(await verifyAdminSessionValue(sessionFromCookieHeader(request.headers.get("cookie"))))) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  const { slug } = await context.params;
  // Según la ruta el slug llega crudo o decodificado: se prueban las dos formas.
  let error = await restoreAdminProduct(slug);
  if (error === NOT_ARCHIVED) {
    let decoded = slug;
    try {
      decoded = decodeURIComponent(slug);
    } catch {
      // `%` literal de la migración: no se puede decodificar, queda crudo.
    }
    if (decoded !== slug) error = await restoreAdminProduct(decoded);
  }
  if (error) {
    return Response.json({ ok: false, error }, { status: 409 });
  }
  const restored = await getAdminProductForEdit(slug);
  refreshStorePages([restored?.slug, slug]);
  await logAdminAction(await actorFromRequest(request), {
    action: "restauracion",
    entityType: "producto",
    entityId: restored?.slug ?? slug,
    summary: `Volvió a publicar ${restored?.name ?? slug}`,
  });
  return Response.json({ ok: true });
}
