import { sessionFromCookieHeader, verifyAdminSessionValue } from "@/lib/admin-auth";
import { updateAdminProduct, type ProductPatch } from "@/lib/admin-products";

export const dynamic = "force-dynamic";

async function authorized(request: Request): Promise<boolean> {
  return verifyAdminSessionValue(sessionFromCookieHeader(request.headers.get("cookie")));
}

export async function PATCH(request: Request, context: { params: Promise<{ slug: string }> }) {
  if (!(await authorized(request))) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  const { slug } = await context.params;
  const body = (await request.json().catch(() => ({}))) as ProductPatch;
  const error = await updateAdminProduct(decodeURIComponent(slug), {
    price: body.price,
    stock: body.stock,
    featured: body.featured,
    badge: body.badge,
  });
  if (error) {
    return Response.json({ ok: false, error }, { status: 400 });
  }
  return Response.json({ ok: true });
}
