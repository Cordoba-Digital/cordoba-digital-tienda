import { sql } from "drizzle-orm";

import { db } from "@/db";
import { products } from "@/db/schema";
import { destinoDeEtiqueta, formasDeEtiqueta } from "@/lib/tag-redirect";

export const dynamic = "force-dynamic";

/**
 * Etiquetas del WordPress viejo: `/etiqueta-producto/<tag>` redirige con 308
 * a la ficha (si la etiqueta es de un solo producto) o a la búsqueda con sus
 * palabras (ver lib/tag-redirect.ts). Antes era una regla de `next.config.ts`
 * que pasaba la etiqueta tal cual a `?q=` y casi siempre daba 0 resultados.
 */
export async function GET(request: Request, { params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params;

  let slugs: string[] = [];
  try {
    const formas = formasDeEtiqueta(tag);
    const condiciones = formas.map((forma) => sql`${products.tags} @> ${JSON.stringify([forma])}::jsonb`);
    const rows = await db
      .select({ slug: products.slug })
      .from(products)
      .where(sql.join(condiciones, sql` or `))
      .limit(2);
    slugs = rows.map((row) => row.slug);
  } catch (error) {
    // Sin base igual se redirige: a la búsqueda por palabras, nunca a un 500.
    console.error("[etiqueta-producto]", error instanceof Error ? error.message : error);
  }

  return new Response(null, {
    status: 308,
    headers: {
      Location: new URL(destinoDeEtiqueta(tag, slugs), request.url).toString(),
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
