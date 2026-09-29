import { inArray } from "drizzle-orm";

import { db } from "@/db";
import { products } from "@/db/schema";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { slugs?: string[] };
  const slugs = (body.slugs ?? []).filter((s) => typeof s === "string").slice(0, 50);
  if (!slugs.length) return Response.json({ ok: true, products: [] });

  await ensureSeeded();
  const rows = await db.select().from(products).where(inArray(products.slug, slugs));

  return Response.json({
    ok: true,
    products: rows.map((p) => ({
      slug: p.slug,
      name: p.name,
      brand: p.brand,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      stock: p.stock,
      image: p.images?.[0] ?? "",
      // El carrito y el checkout muestran una sola imagen: la principal.
      imageSrcSet: p.imageSrcSets?.[0] ?? [],
      freeShipping: p.freeShipping,
    })),
  });
}
