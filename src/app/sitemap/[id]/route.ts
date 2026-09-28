import { getCategoryPaths, listProducts } from "@/lib/queries";

export const dynamic = "force-dynamic";

const BASE = "https://www.cordobadigital.net";

/**
 * Maximo de URLs de producto por submapa. Google permite 50.000, pero 1.000
 * deja los submapas chicos: asi el indice se regenera seguido sin que ningun
 * submapa quede obsoleto.
 */
const PRODUCTS_PER_SITEMAP = 1000;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

type Entry = { loc: string; lastmod?: string; changefreq?: string; priority?: string };

const STATIC_ENTRIES: Entry[] = [
  { loc: `${BASE}/`, changefreq: "daily", priority: "1" },
  { loc: `${BASE}/productos`, changefreq: "daily", priority: "0.9" },
  { loc: `${BASE}/ayuda`, changefreq: "monthly", priority: "0.5" },
  { loc: `${BASE}/seguimiento`, changefreq: "monthly", priority: "0.4" },
];

function renderEntry({ loc, lastmod, changefreq, priority }: Entry): string {
  return [
    "  <url>",
    `    <loc>${escapeXml(loc)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : null,
    priority ? `    <priority>${priority}</priority>` : null,
    "  </url>",
  ]
    .filter((line): line is string => line != null)
    .join("\n");
}

/** Estaticas + las 128 categorias del arbol (son las mismas en todos los submapas). */
async function baseEntries(): Promise<Entry[]> {
  const entries: Entry[] = [...STATIC_ENTRIES];
  const paths = await getCategoryPaths();
  for (const category of paths) {
    entries.push({
      loc: `${BASE}/categoria/${category.path}`,
      changefreq: "weekly",
      priority: "0.7",
    });
  }
  return entries;
}

/**
 * Un submapa del catalogo. Next 16 no registra una carpeta con texto estatico
 * mezclado con un segmento dinamico (`sitemap-[id].xml` da 404), asi que la
 * ruta real es `/sitemap/[id]` y `next.config.ts` reescribe `/sitemap-:id.xml`
 * hacia aca.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: rawId } = await context.params;

  const notFound = () =>
    new Response("Not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });

  if (!/^\d+$/.test(rawId)) return notFound();
  const id = Number.parseInt(rawId, 10);
  if (!Number.isSafeInteger(id)) return notFound();

  const entries: Entry[] = [];
  try {
    const [{ total }, bases] = await Promise.all([listProducts({ perPage: 1 }), baseEntries()]);

    if (id >= Math.max(1, Math.ceil(total / PRODUCTS_PER_SITEMAP))) return notFound();

    entries.push(...bases);

    const page = await listProducts({ perPage: PRODUCTS_PER_SITEMAP, page: id + 1 });
    for (const product of page.items) {
      entries.push({
        loc: `${BASE}/producto/${product.slug}`,
        lastmod: new Date(product.createdAt).toISOString(),
        priority: "0.8",
      });
    }
  } catch {
    // Si la base falla no rompen los submapas: se devuelven solo las estaticas.
    entries.length = 0;
    entries.push(...STATIC_ENTRIES);
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(renderEntry).join("\n")}
</urlset>
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
