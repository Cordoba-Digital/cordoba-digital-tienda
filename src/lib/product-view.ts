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
  imageSrcSet: string[];
  badge: string | null;
  freeShipping: boolean;
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
    imageSrcSet: product.imageSrcSet ?? [],
    badge: product.badge ?? null,
    freeShipping: product.freeShipping,
    highlights: product.highlights ?? [],
  };
}
