import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { products, reviews } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    slug?: string;
    author?: string;
    rating?: number;
    title?: string;
    body?: string;
  };

  const slug = (body.slug ?? "").trim();
  const author = (body.author ?? "").trim().slice(0, 60);
  const rating = Math.max(1, Math.min(5, Math.round(Number(body.rating ?? 5))));
  const text = (body.body ?? "").trim().slice(0, 600);

  if (!slug || author.length < 2 || text.length < 10) {
    return Response.json({ ok: false, error: "Datos incompletos" }, { status: 400 });
  }

  const [product] = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
  if (!product) return Response.json({ ok: false, error: "Producto inexistente" }, { status: 404 });

  await db.insert(reviews).values({
    productSlug: slug,
    author,
    rating,
    title: (body.title ?? "").trim().slice(0, 90),
    body: text,
    verified: false,
  });

  const nextCount = product.reviewCount + 1;
  const nextRating = Math.round((product.rating * product.reviewCount + rating * 10) / nextCount);

  await db
    .update(products)
    .set({ reviewCount: nextCount, rating: sql`${nextRating}` })
    .where(eq(products.slug, slug));

  return Response.json({ ok: true });
}
