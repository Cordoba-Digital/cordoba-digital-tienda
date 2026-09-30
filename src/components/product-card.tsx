"use client";

import Link from "next/link";

import { ProductImg, ProductPlaceholder } from "@/components/product-img";
import { useStore } from "@/components/store-provider";
import { Stars } from "@/components/ui";
import { discountPercent, money } from "@/lib/format";
import type { ProductView } from "@/lib/product-view";

export function ProductCard({ product }: { product: ProductView }) {
  const { toggleFavorite, isFavorite, hydrated, addItem } = useStore();
  const off = discountPercent(product.price, product.compareAtPrice);
  const fav = hydrated && isFavorite(product.slug);
  const outOfStock = product.stock === 0;
  const hoverSrc = product.images[1] && product.images[1] !== product.image ? product.images[1] : null;

  const addToCart = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (outOfStock) return;
    addItem({
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      image: product.image,
      imageSrcSet: product.imageSrcSets[0],
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      stock: product.stock,
      freeShipping: product.freeShipping,
    });
  };

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-ink-100 bg-surface shadow-[0_1px_2px_rgba(10,18,38,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lg">
      <div className="relative">
        <Link href={`/producto/${product.slug}`} className="relative block aspect-square overflow-hidden bg-ink-50 p-5">
          {product.image ? (
            <>
              <ProductImg
                src={product.image}
                srcSet={product.imageSrcSets[0]}
                alt={product.name}
                sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw"
                width={400}
                height={400}
                className={`h-full w-full object-contain transition duration-300 group-hover:scale-105 ${hoverSrc ? "group-hover:opacity-0" : ""}`}
              />
              {hoverSrc ? (
                <div className="absolute inset-5 opacity-0 transition duration-300 group-hover:opacity-100">
                  <ProductImg
                    src={hoverSrc}
                    srcSet={product.imageSrcSets[1]}
                    alt=""
                    sizes="(max-width: 640px) 50vw, 25vw"
                    width={400}
                    height={400}
                    className="h-full w-full object-contain"
                  />
                </div>
              ) : null}
            </>
          ) : (
            <ProductPlaceholder />
          )}
        </Link>

        <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col items-start gap-1">
          {off > 0 ? (
            <span className="rounded-md bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">{off}% OFF</span>
          ) : product.badge ? (
            <span className="rounded-md bg-brand-700 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">{product.badge}</span>
          ) : null}
        </div>

        {outOfStock ? (
          <span className="pointer-events-none absolute left-3 top-3 rounded-md bg-deep px-2 py-0.5 text-[11px] font-bold text-white">
            Sin stock
          </span>
        ) : null}

        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleFavorite(product.slug);
          }}
          aria-label={fav ? "Quitar de favoritos" : "Guardar en favoritos"}
          className={`absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full border bg-surface/90 shadow-sm backdrop-blur transition ${
            fav ? "border-rose-200 text-rose-500" : "border-ink-200 text-ink-400 hover:text-rose-500"
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill={fav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
            <path d="M12 21s-7.5-4.6-9.5-9A5.5 5.5 0 0112 5.5 5.5 5.5 0 0121.5 12c-2 4.4-9.5 9-9.5 9z" />
          </svg>
        </button>
      </div>

      <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-1">
        {product.brand && product.brand !== "General" ? (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">{product.brand}</p>
        ) : null}

        <Link
          href={`/producto/${product.slug}`}
          className="mt-0.5 line-clamp-2 text-[13px] font-medium leading-snug text-ink-800 after:absolute after:inset-0 hover:text-brand-700"
        >
          {product.name}
        </Link>

        {product.reviewCount > 0 ? (
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-ink-500">
            <Stars rating={product.rating} />
            <span className="font-semibold text-ink-700">{(product.rating / 10).toFixed(1)}</span>
            {product.soldCount > 0 ? <span>· {product.soldCount} vendidos</span> : null}
          </div>
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <div>
            {product.compareAtPrice ? (
              <p className="text-[11px] text-ink-500 line-through">{money(product.compareAtPrice)}</p>
            ) : null}
            <p className="text-[1.35rem] font-semibold leading-none tracking-tight text-ink-900">{money(product.price)}</p>
          </div>
          <button
            type="button"
            disabled={outOfStock}
            onClick={addToCart}
            aria-label="Agregar al carrito"
            title={outOfStock ? "Sin stock" : "Agregar al carrito"}
            className="relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-700 text-white shadow-sm transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-ink-200 disabled:text-ink-400"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="9" cy="20" r="1.5" />
              <circle cx="17" cy="20" r="1.5" />
              <path d="M2.5 3.5h2l2.6 12.5a1 1 0 001 .8h8.7a1 1 0 001-.8L20.5 7H6" />
            </svg>
          </button>
        </div>
      </div>
    </article>
  );
}

export function ProductRow({ products }: { products: ProductView[] }) {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
      {products.map((product) => (
        <div key={product.slug} className="w-[210px] shrink-0 snap-start md:w-[228px]">
          <ProductCard product={product} />
        </div>
      ))}
    </div>
  );
}

export function ProductGrid({ products }: { products: ProductView[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.slug} product={product} />
      ))}
    </div>
  );
}
