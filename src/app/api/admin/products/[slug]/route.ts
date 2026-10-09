import { sessionFromCookieHeader, verifyAdminSessionValue } from "@/lib/admin-auth";
import {
  archiveAdminProduct,
  updateAdminProduct,
  updateAdminProductFull,
  type AdminProductCreateInput,
  type ProductPatch,
} from "@/lib/admin-products";

export const dynamic = "force-dynamic";

// El slug va crudo: `findProductBySlug` prueba sus variantes de encoding. Un
// `decodeURIComponent` acá rompía con los slugs migrados que tienen `%` literal.

async function authorized(request: Request): Promise<boolean> {
  return verifyAdminSessionValue(sessionFromCookieHeader(request.headers.get("cookie")));
}

export async function PATCH(request: Request, context: { params: Promise<{ slug: string }> }) {
  if (!(await authorized(request))) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  const { slug } = await context.params;
  const body = (await request.json().catch(() => ({}))) as ProductPatch;
  const error = await updateAdminProduct(slug, {
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

/** Edición completa desde `/admin/productos/[slug]`. */
export async function PUT(request: Request, context: { params: Promise<{ slug: string }> }) {
  if (!(await authorized(request))) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  const { slug } = await context.params;
  const body = (await request.json().catch(() => ({}))) as AdminProductCreateInput;
  const result = await updateAdminProductFull(slug, body);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: result.status });
  }
  return Response.json({ ok: true, slug: result.slug });
}

/** Baja reversible: mueve el producto a archivados. */
export async function DELETE(request: Request, context: { params: Promise<{ slug: string }> }) {
  if (!(await authorized(request))) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  const { slug } = await context.params;
  const error = await archiveAdminProduct(slug);
  if (error) {
    return Response.json({ ok: false, error }, { status: 404 });
  }
  return Response.json({ ok: true });
}
