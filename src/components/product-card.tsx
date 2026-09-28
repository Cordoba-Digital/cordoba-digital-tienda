"use client";

import Link from "next/link";
import { useState } from "react";

import { useStore } from "@/components/store-provider";
import { Pill, Stars } from "@/components/ui";
import { discountPercent, installmentValue, money, transferPrice } from "@/lib/format";
import type { ProductView } from "@/lib/product-view";

export function ProductCard({ product, compact = false }: { product: ProductView; compact?: boolean }) {
  const { addItem, toggleFavorite, isFavorite, hydrated } = useStore();
  const [adding, setAdding] = useState(false);
  const off = discountPercent(product.price, product.compareAtPrice);
  const fav = hydrated && isFavorite(product.slug);
  const lowStock = product.stock > 0 && product.stock <= 5;

  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border border-ink-100 bg-white transition duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-[0_18px_40px_-20px_rgba(27,65,245,0.45)] ${
        compact ? "" : ""
      }`}
    >
      <div className="relative">
        <Link href={`/producto/${product.slug}`} className="block aspect-square overflow-hidden bg-ink-50">
          {product.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-4xl">📦</div>
          )}
        </Link>

        <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {off > 0 ? (
            <span className="rounded-full bg-rose-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
              -{off}%
            </span>
          ) : null}
          {product.badge ? <Pill tone="dark">{product.badge}</Pill> : null}
        </div>

        <button
          type="button"
          onClick={() => toggleFavorite(product.slug)}
          aria-label={fav ? "Quitar de favoritos" : "Guardar en favoritos"}
          className={`absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full border backdrop-blur transition ${
            fav
              ? "border-rose-200 bg-rose-50 text-rose-500"
              : "border-white/60 bg-white/85 text-ink-400 hover:text-rose-500"
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill={fav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
            <path d="M12 21s-7.5-4.6-9.5-9A5.5 5.5 0 0112 5.5 5.5 5.5 0 0121.5 12c-2 4.4-9.5 9-9.5 9z" />
          </svg>
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
          <span>{product.brand}</span>
          {product.freeShipping ? <span className="text-emerald-600">· Envío gratis</span> : null}
        </div>

        <Link
          href={`/producto/${product.slug}`}
          className="line-clamp-2 text-sm font-semibold leading-snug text-ink-800 transition hover:text-brand-700"
        >
          {product.name}
        </Link>

        <div className="flex items-center gap-1.5 text-xs text-ink-400">
          <Stars rating={product.rating} />
          <span>({product.reviewCount})</span>
          {product.soldCount > 100 ? <span className="text-ink-300">· +{product.soldCount} vendidos</span> : null}
        </div>

        <div className="mt-auto pt-1">
          {product.compareAtPrice ? (
            <p className="text-xs text-ink-400 line-through">{money(product.compareAtPrice)}</p>
          ) : null}
          <p className="text-xl font-extrabold tracking-tight text-ink-900">{money(product.price)}</p>
          <p className="text-xs font-medium text-emerald-600">
            {money(transferPrice(product.price))} con transferencia
          </p>
          <p className="text-[11px] text-ink-400">
            6 cuotas sin interés de {money(installmentValue(product.price, 6))}
          </p>
        </div>

        {lowStock ? (
          <p className="text-[11px] font-semibold text-amber-600">¡Quedan {product.stock} unidades!</p>
        ) : null}

        <button
          type="button"
          disabled={product.stock === 0}
          onClick={() => {
            setAdding(true);
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
            );
            window.setTimeout(() => setAdding(false), 600);
          }}
          className="mt-2 w-full rounded-xl bg-ink-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-ink-200 disabled:text-ink-400"
        >
          {product.stock === 0 ? "Sin stock" : adding ? "¡Agregado!" : "Agregar al carrito"}
        </button>
      </div>
    </article>
  );
}

export function ProductRow({ products }: { products: ProductView[] }) {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
      {products.map((product) => (
        <div key={product.slug} className="w-[248px] shrink-0 snap-start md:w-[264px]">
          <ProductCard product={product} />
        </div>
      ))}
    </div>
  );
}

export function ProductGrid({ products }: { products: ProductView[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.slug} product={product} />
      ))}
    </div>
  );
}
