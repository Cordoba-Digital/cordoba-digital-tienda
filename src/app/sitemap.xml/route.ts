import { listProducts } from "@/lib/queries";

export const dynamic = "force-dynamic";

const BASE = "https://www.cordobadigital.net";

/** Maximo de URLs de producto por submapa (debe coincidir con el de `sitemap/[id]`). */
const PRODUCTS_PER_SITEMAP = 1000;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * `/sitemap.xml` es el indice de sitemaps.
 *
 * No puede vivir en `src/app/sitemap.ts` porque la convencion de MetadataRoute
 * siempre serializa un `<urlset>`, y un indice de sitemaps tiene que ser un
 * `<sitemapindex>` segun https://www.sitemaps.org/protocol.html. Por eso lo
 * servimos con un Route Handler.
 */
export async function GET(): Promise<Response> {
  let count = 1;
  try {
    const { total } = await listProducts({ perPage: 1 });
    count = Math.max(1, Math.ceil(total / PRODUCTS_PER_SITEMAP));
  } catch {
    // Si la base no responde emitimos el indice minimo en vez de un 500.
  }
  const now = new Date().toISOString();

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Array.from({ length: count }, (_, id) => `  <sitemap>
    <loc>${escapeXml(`${BASE}/sitemap-${id}.xml`)}</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`).join("\n")}
</sitemapindex>
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
