import { asc } from "drizzle-orm";

import { db } from "@/db";
import { products } from "@/db/schema";
import { renderLocalFeed, renderLocalItem, skipReason } from "@/lib/merchant-feed";

export const dynamic = "force-dynamic";

/**
 * `/local-inventory.xml`: inventario del local para Merchant Center.
 *
 * Se carga como fuente de inventario local (Configuración > Fuentes de datos >
 * Inventario local > URL). Lleva los mismos productos que `/products.xml`, con
 * el stock de la base, así que una venta en la web o en el mostrador baja la
 * cantidad en la siguiente descarga.
 */
export async function GET(): Promise<Response> {
  try {
    const rows = await db
      .select({
        slug: products.slug,
        name: products.name,
        brand: products.brand,
        categorySlug: products.categorySlug,
        shortDescription: products.shortDescription,
        description: products.description,
        descriptionHtml: products.descriptionHtml,
        price: products.price,
        compareAtPrice: products.compareAtPrice,
        stock: products.stock,
        images: products.images,
        condition: products.condition,
        freeShipping: products.freeShipping,
      })
      .from(products)
      .orderBy(asc(products.id));

    // Mismo filtro que el feed principal: un id que no está en `/products.xml`
    // Merchant Center lo descarta con advertencia.
    const items = rows.filter((row) => skipReason(row) == null).map((row) => renderLocalItem(row));

    return new Response(renderLocalFeed(items, new Date()), {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("[local-inventory.xml]", error);
    return new Response("Feed temporalmente no disponible", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "600", "Cache-Control": "no-store" },
    });
  }
}
