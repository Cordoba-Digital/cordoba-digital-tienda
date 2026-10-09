import { sessionFromCookieHeader, verifyAdminSessionValue } from "@/lib/admin-auth";
import { restoreAdminProduct } from "@/lib/admin-products";

export const dynamic = "force-dynamic";

/** Vuelve a publicar un producto archivado. */
export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  if (!(await verifyAdminSessionValue(sessionFromCookieHeader(request.headers.get("cookie"))))) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  const { slug } = await context.params;
  const error = await restoreAdminProduct(decodeURIComponent(slug));
  if (error) {
    return Response.json({ ok: false, error }, { status: 409 });
  }
  return Response.json({ ok: true });
}
