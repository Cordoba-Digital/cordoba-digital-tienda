import { asc } from "drizzle-orm";

import { db } from "@/db";
import { products } from "@/db/schema";
import { ancestorsOf, flattenTree } from "@/lib/category-tree";
import { renderFeed, renderItem, skipReason } from "@/lib/merchant-feed";
import { getCategoryTree } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * `/products.xml`: feed de Google Merchant Center.
 *
 * Merchant Center lo descarga en forma programada (Productos > Fuentes de
 * datos > Agregar feed > URL). Se arma en cada pedido desde Neon, así que un
 * alta o cambio de precio en el admin llega en la siguiente descarga sin
 * pasos manuales; el CDN lo guarda una hora para que un fetch repetido no le
 * pegue a la base.
 */
export async function GET(): Promise<Response> {
  try {
    const [rows, tree] = await Promise.all([
      db
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
        .orderBy(asc(products.id)),
      getCategoryTree(),
    ]);

    // `product_type`: la ruta de la categoría principal, "Celulares > Xiaomi".
    const flat = flattenTree(tree);
    const byId = new Map(flat.map((node) => [node.id, node]));
    const productType = new Map(
      flat.map((node) => [node.slug, [...ancestorsOf(node, byId), node].map((n) => n.name).join(" > ")]),
    );

    const items = rows
      .filter((row) => skipReason(row) == null)
      .map((row) => renderItem(row, productType.get(row.categorySlug) ?? ""));

    return new Response(renderFeed(items, new Date()), {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("[products.xml]", error);
    // Nunca HTML ni un 500 con el feed a medias: un 503 le indica a Merchant
    // Center que reintente y conserva los productos de la última descarga buena.
    return new Response("Feed temporalmente no disponible", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "600", "Cache-Control": "no-store" },
    });
  }
}
