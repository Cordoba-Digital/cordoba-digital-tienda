import type { Product } from "@/db/schema";

export type ProductView = {
  slug: string;
  name: string;
  brand: string;
  categorySlug: string;
  shortDescription: string;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  rating: number;
  reviewCount: number;
  soldCount: number;
  image: string;
  images: string[];
  /** Un srcset por entrada de `images`, en el mismo orden. */
  imageSrcSets: string[][];
  badge: string | null;
  freeShipping: boolean;
  /** Meses de garantía reales del producto: la tarjeta los muestra. */
  warrantyMonths: number;
  highlights: string[];
};

export function toView(product: Product): ProductView {
  return {
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    categorySlug: product.categorySlug,
    shortDescription: product.shortDescription,
    price: product.price,
    compareAtPrice: product.compareAtPrice ?? null,
    stock: product.stock,
    rating: product.rating,
    reviewCount: product.reviewCount,
    soldCount: product.soldCount,
    image: product.images?.[0] ?? "",
    images: product.images ?? [],
    imageSrcSets: product.imageSrcSets ?? [],
    badge: product.badge ?? null,
    freeShipping: product.freeShipping,
    warrantyMonths: product.warrantyMonths,
    highlights: product.highlights ?? [],
  };
}
