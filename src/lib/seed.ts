import { sql } from "drizzle-orm";

import { db } from "@/db";
import { categories, coupons, products, reviews } from "@/db/schema";
import { reviewsForProduct, seedCategories, seedCoupons, seedProducts } from "@/lib/catalog-data";

let seeding: Promise<void> | null = null;

async function runSeed() {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(products);
  if ((row?.count ?? 0) > 0) return;

  await db.insert(categories).values(seedCategories).onConflictDoNothing();

  await db
    .insert(products)
    .values(
      seedProducts.map((p) => ({
        slug: p.slug,
        sku: p.sku,
        name: p.name,
        brand: p.brand,
        categorySlug: p.categorySlug,
        shortDescription: p.shortDescription,
        description: p.description,
        price: p.price,
        compareAtPrice: p.compareAtPrice ?? null,
        stock: p.stock,
        rating: p.rating,
        reviewCount: p.reviewCount,
        soldCount: p.soldCount,
        images: p.images,
        highlights: p.highlights,
        specs: p.specs,
        tags: p.tags,
        badge: p.badge ?? null,
        featured: p.featured ?? false,
        freeShipping: p.freeShipping ?? false,
        warrantyMonths: p.warrantyMonths,
      })),
    )
    .onConflictDoNothing();

  const allReviews = seedProducts.flatMap((p) => reviewsForProduct(p.slug, p.reviewCount));
  if (allReviews.length) {
    await db.insert(reviews).values(allReviews);
  }

  await db.insert(coupons).values(seedCoupons).onConflictDoNothing();
}

/** Idempotent, lazy seeding so the storefront always has a catalog. */
export async function ensureSeeded(): Promise<void> {
  if (!seeding) {
    seeding = runSeed().catch((error) => {
      seeding = null;
      throw error;
    });
  }
  await seeding;
}
