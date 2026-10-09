import { sessionFromCookieHeader, verifyAdminSessionValue } from "@/lib/admin-auth";
import { actorFromRequest, diffFields, fieldLabel, logAdminAction } from "@/lib/admin-audit";
import {
  archiveAdminProduct,
  getAdminProductForEdit,
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
  const before = await getAdminProductForEdit(slug);
  const patch = { price: body.price, stock: body.stock, featured: body.featured, badge: body.badge };
  const error = await updateAdminProduct(slug, patch);
  if (error) {
    return Response.json({ ok: false, error }, { status: 400 });
  }
  if (before) {
    const after = await getAdminProductForEdit(before.slug);
    const changes = after ? diffFields(before, after, ["price", "stock", "featured", "badge"]) : {};
    if (Object.keys(changes).length) {
      await logAdminAction(await actorFromRequest(request), {
        action: "edicion_rapida",
        entityType: "producto",
        entityId: before.slug,
        summary: `${before.name}: ${Object.keys(changes).map(fieldLabel).join(", ")}`,
        changes,
      });
    }
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
  const before = await getAdminProductForEdit(slug);
  const result = await updateAdminProductFull(slug, body);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: result.status });
  }
  const after = await getAdminProductForEdit(result.slug);
  if (before && after) {
    const { origin: _beforeOrigin, ...beforeFields } = before;
    const { origin: _afterOrigin, ...afterFields } = after;
    const changes = diffFields(beforeFields, afterFields);
    if (Object.keys(changes).length) {
      await logAdminAction(await actorFromRequest(request), {
        action: "edicion",
        entityType: "producto",
        entityId: result.slug,
        summary: `${after.name}: ${Object.keys(changes).map(fieldLabel).join(", ")}`,
        changes,
      });
    }
  }
  return Response.json({ ok: true, slug: result.slug });
}

/** Baja reversible: mueve el producto a archivados. */
export async function DELETE(request: Request, context: { params: Promise<{ slug: string }> }) {
  if (!(await authorized(request))) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  const { slug } = await context.params;
  const before = await getAdminProductForEdit(slug);
  const error = await archiveAdminProduct(slug);
  if (error) {
    return Response.json({ ok: false, error }, { status: 404 });
  }
  await logAdminAction(await actorFromRequest(request), {
    action: "archivo",
    entityType: "producto",
    entityId: before?.slug ?? slug,
    summary: `Archivó ${before?.name ?? slug}`,
  });
  return Response.json({ ok: true });
}
