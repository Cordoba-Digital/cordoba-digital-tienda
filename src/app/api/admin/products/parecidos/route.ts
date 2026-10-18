import { sessionFromCookieHeader } from "@/lib/admin-auth";
import { similarityTerms } from "@/lib/admin-product-autofill";
import { findSimilarProducts, listKnownBrands } from "@/lib/admin-products";
import { verifyAdminSessionValue } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

/**
 * Productos ya cargados parecidos al que se está dando de alta (mismo modelo,
 * otra variante), para copiar su categoría y su ficha. Solo lectura.
 */
export async function GET(request: Request) {
  if (!(await verifyAdminSessionValue(sessionFromCookieHeader(request.headers.get("cookie"))))) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  const name = (new URL(request.url).searchParams.get("nombre") ?? "").trim().slice(0, 200);
  if (name.length < 3) return Response.json({ ok: true, items: [] });
  const terms = similarityTerms(name, await listKnownBrands());
  return Response.json({ ok: true, items: await findSimilarProducts(name, terms) });
}
