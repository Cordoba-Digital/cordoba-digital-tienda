"use client";

import Link from "next/link";

import { ProductCard } from "@/components/product-card";
import { useStore } from "@/components/store-provider";
import type { ProductView } from "@/lib/product-view";

export function FavoritesView({ products }: { products: ProductView[] }) {
  const { favorites, hydrated, addItem } = useStore();
  const saved = products.filter((product) => favorites.includes(product.slug));

  if (!hydrated) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-80 animate-pulse rounded-2xl bg-surface" />
        ))}
      </div>
    );
  }

  if (!saved.length) {
    return (
      <div className="card-surface mx-auto flex max-w-xl flex-col items-center gap-3 px-8 py-16 text-center">
        <span className="text-6xl">💙</span>
        <h2 className="text-xl font-extrabold text-ink-900">Todavía no guardaste favoritos</h2>
        <p className="text-sm text-ink-500">
          Tocá el corazón en cualquier producto para guardarlo y compararlo después.
        </p>
        <Link href="/productos" className="mt-2 rounded-xl bg-brand-700 px-5 py-3 text-sm font-bold text-white">
          Explorar catálogo
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-500">{saved.length} producto{saved.length === 1 ? "" : "s"} guardados</p>
        <button
          type="button"
          onClick={() =>
            saved
              .filter((product) => product.stock > 0)
              .forEach((product, index) =>
                addItem(
                  {
                    slug: product.slug,
                    name: product.name,
                    brand: product.brand,
                    image: product.image,
                    price: product.price,
                    compareAtPrice: product.compareAtPrice,
                    stock: product.stock,
                    freeShipping: product.freeShipping,
                  },
                  1,
                  { silent: index > 0, open: index === saved.length - 1 },
                ),
              )
          }
          className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-800"
        >
          Agregar todo al carrito
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {saved.map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
      </div>
    </>
  );
}
