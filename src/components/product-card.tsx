"use client";

import { useRef, useState } from "react";

import Link from "next/link";

import { ProductImg, ProductPlaceholder } from "@/components/product-img";
import { useStore } from "@/components/store-provider";
import { Stars } from "@/components/ui";
import { discountPercent, money } from "@/lib/format";
import type { ProductView } from "@/lib/product-view";

export function ProductCard({ product, badge }: { product: ProductView; badge?: string }) {
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
    <article className="group relative flex h-full flex-col rounded-2xl bg-surface p-2.5 shadow-sm ring-1 ring-black/[0.05] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgba(20,22,28,0.45)]">
      <div className="relative">
        <Link href={`/producto/${product.slug}`} className="relative block aspect-[5/4] overflow-hidden rounded-xl bg-ink-50 p-4">
          {product.image ? (
            <>
              <ProductImg
                src={product.image}
                srcSet={product.imageSrcSets[0]}
                alt={product.name}
                sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw"
                width={400}
                height={320}
                className={`h-full w-full object-contain transition duration-300 group-hover:scale-105 ${hoverSrc ? "group-hover:opacity-0" : ""}`}
              />
              {hoverSrc ? (
                <div className="absolute inset-4 opacity-0 transition duration-300 group-hover:opacity-100">
                  <ProductImg
                    src={hoverSrc}
                    srcSet={product.imageSrcSets[1]}
                    alt=""
                    sizes="(max-width: 640px) 50vw, 25vw"
                    width={400}
                    height={320}
                    className="h-full w-full object-contain"
                  />
                </div>
              ) : null}
            </>
          ) : (
            <ProductPlaceholder />
          )}
        </Link>

        {off > 0 ? (
          <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-rose-600 px-1.5 py-0.5 text-[11px] font-extrabold tracking-wide text-white">
            {off}% OFF
          </span>
        ) : product.badge ? (
          <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-brand-700 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
            {product.badge}
          </span>
        ) : null}

        {badge ? (
          <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-deep/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            {badge}
          </span>
        ) : null}

        {outOfStock ? (
          <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-deep px-2 py-0.5 text-[11px] font-bold text-white">
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
          className={`absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-surface/95 shadow-sm backdrop-blur transition ${
            fav ? "text-rose-500" : "text-ink-400 hover:text-rose-500"
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill={fav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
            <path d="M12 21s-7.5-4.6-9.5-9A5.5 5.5 0 0112 5.5 5.5 5.5 0 0121.5 12c-2 4.4-9.5 9-9.5 9z" />
          </svg>
        </button>
      </div>

      <div className="flex flex-1 flex-col px-1 pb-1 pt-3">
        {product.brand && product.brand !== "General" ? (
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">{product.brand}</p>
        ) : null}

        <Link
          href={`/producto/${product.slug}`}
          className="mt-1 line-clamp-2 min-h-10 text-[13.5px] font-semibold leading-snug text-ink-900 after:absolute after:inset-0 hover:text-brand-700"
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
              <p className="text-xs text-ink-400 line-through">{money(product.compareAtPrice)}</p>
            ) : null}
            <p className="text-[17px] font-extrabold tracking-tight leading-none text-ink-900">{money(product.price)}</p>
          </div>
          <button
            type="button"
            disabled={outOfStock}
            onClick={addToCart}
            aria-label="Agregar al carrito"
            title={outOfStock ? "Sin stock" : "Agregar al carrito"}
            className="relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-700 text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-ink-200 disabled:text-ink-400"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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

/**
 * Tira desplazable de productos.
 *
 * Las flechas son un atajo, no el mecanismo: la tira scrolpea con rueda, panel
 * táctil y teclado, y las flechas solo la mueven un ancho de tarjeta. La fila de
 * categorías del home no usa flechas (va con `scroll-minimo` a secas).
 */
export function ProductRow({ products, label }: { products: ProductView[]; label: string }) {
  // Referencia normal y no un estado: la tira no se vuelve a pintar cuando el
  // nodo se monta o se desmonta, y `move` lee el nodo por `ref.current`.
  const ref = useRef<HTMLDivElement | null>(null);
  const move = (dir: -1 | 1) => ref.current?.scrollBy({ left: dir * 280, behavior: "smooth" });

  return (
    <div className="relative">
      <div
        ref={ref}
        className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto scroll-smooth px-4 pb-2 md:mx-0 md:px-0"
      >
        {products.map((product) => (
          <div key={product.slug} className="w-[210px] shrink-0 snap-start md:w-[228px]">
            <ProductCard product={product} />
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => move(-1)}
        aria-label={`Ver productos anteriores de ${label}`}
        className="absolute -left-3 top-[38%] hidden h-10 w-10 place-items-center rounded-full border border-ink-100 bg-surface text-ink-700 shadow-md transition hover:bg-brand-50 hover:text-brand-700 md:grid"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => move(1)}
        aria-label={`Ver más productos de ${label}`}
        className="absolute -right-3 top-[38%] hidden h-10 w-10 place-items-center rounded-full border border-ink-100 bg-surface text-ink-700 shadow-md transition hover:bg-brand-50 hover:text-brand-700 md:grid"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>
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
