import type { Product } from "@/db/schema";

import { resolveMedia, resolveSrcSet } from "@/lib/media";

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
  highlights: string[];
};

/** Fila mínima para una tarjeta: todo lo que `toView` lee, sin el HTML de la
    descripción ni las columnas pesadas que el catálogo nunca muestra. */
export type CardRow = Pick<
  Product,
  | "slug"
  | "name"
  | "brand"
  | "categorySlug"
  | "shortDescription"
  | "price"
  | "compareAtPrice"
  | "stock"
  | "rating"
  | "reviewCount"
  | "soldCount"
  | "images"
  | "imageSrcSets"
  | "badge"
  | "freeShipping"
  | "highlights"
>;

export function toView(product: CardRow): ProductView {
  const images = (product.images ?? []).map((url) => resolveMedia(url));
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
    image: images[0] ?? "",
    images,
    imageSrcSets: (product.imageSrcSets ?? []).map((set) => resolveSrcSet(set)),
    badge: product.badge ?? null,
    freeShipping: product.freeShipping,
    highlights: product.highlights ?? [],
  };
}

/**
 * Lo que necesita una `ProductCard` y nada más: las dos primeras fotos (la
 * segunda es la del hover) y sin descripción ni destacados. Las grillas mandan
 * decenas de tarjetas al navegador; con `toView` viajaba la galería entera de
 * cada producto en el HTML y otra vez en el payload de React.
 */
export function toCardView(product: CardRow): ProductView {
  const view = toView(product);
  return {
    ...view,
    shortDescription: "",
    images: view.images.slice(0, 2),
    imageSrcSets: view.imageSrcSets.slice(0, 2),
    highlights: [],
  };
}
