import { sessionFromCookieHeader, verifyAdminSessionValue } from "@/lib/admin-auth";
import { actorFromRequest, logAdminAction } from "@/lib/admin-audit";
import { createAdminProduct, listAdminProducts, listProductCategories, type AdminProductCreateInput } from "@/lib/admin-products";

export const dynamic = "force-dynamic";

async function authorized(request: Request): Promise<boolean> {
  return verifyAdminSessionValue(sessionFromCookieHeader(request.headers.get("cookie")));
}

function flag(v: string | null): boolean {
  return v === "1" || v?.toLowerCase() === "true";
}

export async function GET(request: Request) {
  if (!(await authorized(request))) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const [result, categories] = await Promise.all([
    listAdminProducts({
      q: searchParams.get("q") ?? "",
      category: searchParams.get("categoria") ?? "",
      sinStock: flag(searchParams.get("sinStock")),
      oferta: flag(searchParams.get("oferta")),
      destacados: flag(searchParams.get("destacados")),
      page: Number(searchParams.get("page") ?? 1) || 1,
      perPage: Number(searchParams.get("perPage") ?? 20) || 20,
    }),
    listProductCategories(),
  ]);
  return Response.json({ ok: true, ...result, categories });
}

export async function POST(request: Request) {
  if (!(await authorized(request))) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as AdminProductCreateInput;
  const result = await createAdminProduct(body);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: result.status });
  }
  await logAdminAction(await actorFromRequest(request), {
    action: "alta",
    entityType: "producto",
    entityId: result.slug,
    summary: `Creó ${typeof body.name === "string" ? body.name.trim() : result.slug}`,
  });
  return Response.json({ ok: true, slug: result.slug });
}
