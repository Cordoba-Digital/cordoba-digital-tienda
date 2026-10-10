import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { products } from "@/db/schema";

export const dynamic = "force-dynamic";

/**
 * Textos actuales de las fichas de una categoría, para armar los lotes de
 * `data/fichas/` (ver `scripts/fichas.ts`). Es la misma información que ya se
 * ve en cada ficha pública, en JSON compacto y por páginas.
 *
 * Solo responde en preview y desarrollo: en producción devuelve 404.
 *
 *   /api/fichas-export?categoria=celulares-cordoba&desde=0&cantidad=50
 *   /api/fichas-export?desde=0&cantidad=100   (todas las categorías)
 */
export async function GET(request: Request) {
  if (process.env.VERCEL_ENV === "production") return new Response("Not found", { status: 404 });

  const { searchParams } = new URL(request.url);
  // Sin `categoria` devuelve todo el catálogo (paginado), para priorizar lotes.
  const categoria = searchParams.get("categoria")?.trim();
  const desde = Math.max(0, Number(searchParams.get("desde") ?? 0) || 0);
  const cantidad = Math.min(100, Math.max(1, Number(searchParams.get("cantidad") ?? 50) || 50));

  const filas = await db
    .select({
      slug: products.slug,
      name: products.name,
      brand: products.brand,
      sku: products.sku,
      price: products.price,
      stock: products.stock,
      model: products.model,
      storage: products.storage,
      ram: products.ram,
      seoTitle: products.seoTitle,
      shortDescription: products.shortDescription,
      categorySlug: products.categorySlug,
      description: products.description,
      highlights: products.highlights,
      specs: products.specs,
    })
    .from(products)
    .where(categoria ? eq(products.categorySlug, categoria) : undefined)
    .orderBy(asc(products.slug))
    .limit(cantidad)
    .offset(desde);

  return Response.json({
    desde,
    cantidad: filas.length,
    productos: filas.map((p) => ({ ...p, description: p.description.slice(0, 6000) })),
  });
}
