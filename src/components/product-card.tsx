"use client";

import Link from "next/link";

import { ProductImg } from "@/components/product-img";
import { useStore } from "@/components/store-provider";
import { Pill, Stars } from "@/components/ui";
import {
  FREE_SHIPPING_THRESHOLD,
  discountPercent,
  installmentValue,
  money,
  transferPrice,
} from "@/lib/format";
import type { ProductView } from "@/lib/product-view";

/** Chip verde de Mercado Libre: "Llega gratis hoy" / "Envío gratis". */
function ShippingTag({ free, today }: { free: boolean; today: boolean }) {
  return (
    <span className="mt-1.5 inline-block rounded-sm bg-emerald-600 px-2 py-[3px] text-[11px] font-semibold text-white">
      {today ? "Llega gratis hoy" : free ? "Envío gratis" : "Envío gratis desde $250.000"}
    </span>
  );
}

export function ProductCard({ product }: { product: ProductView }) {
  const { toggleFavorite, isFavorite, hydrated } = useStore();
  const off = discountPercent(product.price, product.compareAtPrice);
  const fav = hydrated && isFavorite(product.slug);
  const outOfStock = product.stock === 0;

  // "Envío gratis" con la misma regla que usa el checkout (monto mínimo), no
  // un dato inventado en la tarjeta.
  const freeShipping = product.freeShipping || product.price >= FREE_SHIPPING_THRESHOLD;

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-ink-200 bg-white transition hover:border-brand-300 hover:shadow-md">
      <div className="relative">
        <Link
          href={`/producto/${product.slug}`}
          className="block aspect-square overflow-hidden bg-white p-4"
          tabIndex={-1}
          aria-hidden
        >
          {product.image ? (
            <ProductImg
              src={product.image}
              srcSet={product.imageSrcSet}
              alt=""
              sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw"
              width={400}
              height={400}
              className="h-full w-full object-contain transition duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-4xl">📦</div>
          )}
        </Link>

        {/* El descuento va arriba del precio (como en Mercado Libre), no sobre la foto. */}
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {off > 0 ? (
            <span className="rounded-md bg-rose-500 px-2 py-0.5 text-[11px] font-bold text-white">
              -{off}%
            </span>
          ) : null}
          {off <= 0 && product.badge ? <Pill tone="brandSolid">{product.badge}</Pill> : null}
          {outOfStock ? <Pill tone="neutral">Sin stock</Pill> : null}
        </div>

        <button
          type="button"
          onClick={() => toggleFavorite(product.slug)}
          aria-label={fav ? "Quitar de favoritos" : "Guardar en favoritos"}
          className={`absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border bg-white/90 backdrop-blur transition ${
            fav ? "border-rose-200 text-rose-500" : "border-ink-200 text-ink-400 hover:text-rose-500"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill={fav ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 21s-7.5-4.6-9.5-9A5.5 5.5 0 0112 5.5 5.5 5.5 0 0121.5 12c-2 4.4-9.5 9-9.5 9z" />
          </svg>
        </button>
      </div>

      <div className="flex flex-1 flex-col p-3">
        <Link
          href={`/producto/${product.slug}`}
          className="line-clamp-2 text-[13px] leading-snug text-ink-800 hover:text-brand-700"
        >
          {product.name}
        </Link>

        {product.brand && product.brand !== "General" ? (
          <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-400">
            {product.brand}
          </p>
        ) : null}

        {/* Solo si hay datos reales: WooCommerce no tiene ratings por producto. */}
        {product.reviewCount > 0 ? (
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-ink-500">
            <Stars rating={product.rating} />
            <span className="font-semibold text-ink-700">{(product.rating / 10).toFixed(1)}</span>
            {product.soldCount > 0 ? <span>· {product.soldCount} vendidos</span> : null}
          </div>
        ) : null}

        <div className="mt-2">
          {product.compareAtPrice ? (
            <p className="text-[11px] text-ink-400 line-through">{money(product.compareAtPrice)}</p>
          ) : null}
          <div className="flex flex-wrap items-baseline gap-1.5">
            <p className="text-xl font-light tracking-tight text-ink-900">{money(product.price)}</p>
            {off > 0 ? (
              <span className="rounded-sm bg-emerald-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
                {off}% OFF
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-[11px] text-ink-500">
            6 cuotas de {money(installmentValue(product.price, 6))}
          </p>
          <p className="text-[11px] font-semibold text-emerald-700">
            {money(transferPrice(product.price))} con transferencia
          </p>
          <ShippingTag free={freeShipping} today={freeShipping && product.price >= 500_000_00} />
        </div>

        <div className="mt-auto pt-3">
          <Link
            href={`/producto/${product.slug}`}
            className={`block w-full rounded-md py-2.5 text-center text-sm font-semibold transition ${
              outOfStock
                ? "border border-ink-200 bg-white text-ink-400"
                : "bg-ink-900 text-white hover:bg-brand-600"
            }`}
          >
            {outOfStock ? "Sin stock" : "Ver más"}
          </Link>
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
