import { getProductsBySlugs, listProducts } from "@/lib/queries";
import { toView } from "@/lib/product-view";

export const dynamic = "force-dynamic";

const MAX_SLUGS = 12;
const MAX_PAGINA = 20;
const POR_PAGINA = 10;

/**
 * Tarjetas de producto para los bloques de la home que se completan en el
 * navegador:
 *   ?slugs=a,b,c  → esos productos, en ese orden ("Seguí donde lo dejaste").
 *   ?pagina=2     → la página siguiente del catálogo con stock ("Seguí explorando").
 * Solo lectura de datos públicos, así que la respuesta se puede cachear.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const headers = { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" };

  try {
    const slugsParam = params.get("slugs");
    if (slugsParam != null) {
      const slugs = [...new Set(slugsParam.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, MAX_SLUGS);
      const rows = await getProductsBySlugs(slugs);
      const bySlug = new Map(rows.map((row) => [row.slug, row]));
      const products = slugs.flatMap((slug) => {
        const row = bySlug.get(slug);
        return row ? [toView(row)] : [];
      });
      return Response.json({ products }, { headers });
    }

    const pagina = Math.min(MAX_PAGINA, Math.max(1, Math.floor(Number(params.get("pagina")) || 1)));
    const { items, pages } = await listProducts({ inStock: true, page: pagina, perPage: POR_PAGINA });
    return Response.json({ products: items.map(toView), hasMore: pagina < Math.min(pages, MAX_PAGINA) }, { headers });
  } catch (error) {
    console.error("[api/productos]", error instanceof Error ? error.message : error);
    return Response.json({ products: [], hasMore: false }, { status: 200 });
  }
}
