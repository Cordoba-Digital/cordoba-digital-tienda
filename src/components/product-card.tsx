"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";

import { InstallmentsLine } from "@/components/installments-provider";
import { UsdLine } from "@/components/usd-price";
import { ProductImg, ProductPlaceholder } from "@/components/product-img";
import { useStoreSelector } from "@/components/store-provider";
import { Stars } from "@/components/ui";
import { discountPercent, money } from "@/lib/format";
import { MAX_QTY_PER_ITEM } from "@/lib/pricing";
import type { ProductView } from "@/lib/product-view";

export function ProductCard({ product, badge }: { product: ProductView; badge?: string }) {
  // Cada tarjeta lee solo lo suyo: tocar un favorito o agregar otro producto
  // no redibuja las demás tarjetas de la página.
  const toggleFavorite = useStoreSelector((s) => s.toggleFavorite);
  const addItem = useStoreSelector((s) => s.addItem);
  const setQuantity = useStoreSelector((s) => s.setQuantity);
  const removeItem = useStoreSelector((s) => s.removeItem);
  const fav = useStoreSelector((s) => s.hydrated && s.favorites.includes(product.slug));
  const inCart = useStoreSelector((s) => (s.hydrated ? (s.items.find((i) => i.slug === product.slug)?.quantity ?? 0) : 0));
  const off = discountPercent(product.price, product.compareAtPrice);
  const outOfStock = product.stock === 0;
  const hoverSrc = product.images[1] && product.images[1] !== product.image ? product.images[1] : null;
  const maxQty = product.stock > 1 ? Math.min(product.stock, MAX_QTY_PER_ITEM) : MAX_QTY_PER_ITEM;
  // Aviso breve sobre la foto al agregar desde la tarjeta: el panel lateral ya
  // no se abre, así que la confirmación tiene que estar acá.
  const [added, setAdded] = useState(0);
  useEffect(() => {
    if (!added) return;
    const id = window.setTimeout(() => setAdded(0), 1600);
    return () => window.clearTimeout(id);
  }, [added]);

  const stop = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const addToCart = (event: React.MouseEvent) => {
    stop(event);
    if (outOfStock) return;
    addItem(
      {
        slug: product.slug,
        name: product.name,
        brand: product.brand,
        image: product.image,
        imageSrcSet: product.imageSrcSets[0],
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        stock: product.stock,
        freeShipping: product.freeShipping,
      },
      1,
      { silent: true, open: false },
    );
    setAdded(Date.now());
  };

  return (
    <article className="group relative flex h-full flex-col rounded-xl bg-surface p-1.5 shadow-sm sm:rounded-2xl sm:p-2.5 ring-1 ring-black/[0.05] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgba(20,22,28,0.45)]">
      <div className="relative">
        <Link href={`/producto/${product.slug}`} className="relative block aspect-[5/4] overflow-hidden rounded-lg bg-white p-2 sm:rounded-xl sm:p-4">
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
                <div className="absolute inset-2 opacity-0 sm:inset-4 transition duration-300 group-hover:opacity-100">
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
          <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-md bg-rose-600 px-1.5 py-0.5 text-[10px] font-extrabold sm:left-2 sm:top-2 sm:text-[11px] tracking-wide text-white">
            {off}% OFF
          </span>
        ) : product.badge ? (
          <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-brand-700 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
            {product.badge}
          </span>
        ) : null}

        {added ? (
          <span
            key={added}
            className="pointer-events-none absolute bottom-2 right-2 animate-pop rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm motion-reduce:animate-none"
          >
            ✓ Agregado
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
          className={`absolute right-1.5 top-1.5 z-10 grid h-7 w-7 place-items-center sm:right-2 sm:top-2 sm:h-8 sm:w-8 rounded-full bg-surface/95 shadow-sm backdrop-blur transition ${
            fav ? "text-rose-500" : "text-ink-400 hover:text-rose-500"
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill={fav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
            <path d="M12 21s-7.5-4.6-9.5-9A5.5 5.5 0 0112 5.5 5.5 5.5 0 0121.5 12c-2 4.4-9.5 9-9.5 9z" />
          </svg>
        </button>
      </div>

      <div className="flex flex-1 flex-col px-1 pb-0.5 pt-2 sm:pb-1 sm:pt-3">
        {product.brand && product.brand !== "General" ? (
          <p className="hidden text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400 sm:block">{product.brand}</p>
        ) : null}

        <Link
          href={`/producto/${product.slug}`}
          className="line-clamp-2 min-h-[2.75em] text-[12.5px] font-medium leading-snug sm:mt-1 sm:min-h-10 sm:text-[13.5px] sm:font-semibold text-ink-900 after:absolute after:inset-0 hover:text-brand-700"
        >
          {product.name}
        </Link>

        {product.reviewCount > 0 ? (
          <div className="mt-1 flex items-center gap-1 text-[11px] text-ink-500 sm:mt-1.5 sm:gap-1.5">
            <Stars rating={product.rating} />
            <span className="font-semibold text-ink-700">{(product.rating / 10).toFixed(1)}</span>
            {product.soldCount > 0 ? <span className="hidden sm:inline">· {product.soldCount} vendidos</span> : null}
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap items-end justify-between gap-1.5 pt-2 sm:gap-2 sm:pt-3">
          <div>
            {product.compareAtPrice ? (
              <p className="text-[11px] text-ink-400 line-through sm:text-xs">{money(product.compareAtPrice)}</p>
            ) : null}
            <p className="text-[15px] font-extrabold tracking-tight leading-none text-ink-900 sm:text-[17px]">{money(product.price)}</p>
            <UsdLine price={product.price} className="mt-0.5 text-[11px] font-semibold leading-tight text-ink-500 sm:text-xs" />
            {outOfStock ? null : <InstallmentsLine price={product.price} className="mt-1 text-[11px] font-semibold leading-tight text-emerald-700 sm:text-[11.5px]" />}
          </div>
          {inCart > 0 ? (
            // Ya está en el carrito: la cantidad se ajusta acá mismo. Restar
            // desde 1 lo quita y vuelve el botón de agregar.
            <div
              role="group"
              aria-label={`Cantidad en el carrito: ${inCart}`}
              className="relative z-10 ml-auto inline-flex h-8 shrink-0 animate-pop sm:h-9 items-center rounded-full bg-brand-700 text-white motion-reduce:animate-none"
            >
              <button
                type="button"
                aria-label={inCart === 1 ? "Quitar del carrito" : "Restar uno"}
                onClick={(event) => {
                  stop(event);
                  // `setQuantity` no baja de 1, así que el último se quita aparte.
                  if (inCart === 1) removeItem(product.slug);
                  else setQuantity(product.slug, inCart - 1);
                }}
                className="grid h-8 w-7 place-items-center rounded-l-full sm:h-9 sm:w-8 text-base font-bold transition hover:bg-brand-800"
              >
                −
              </button>
              <span aria-live="polite" className="min-w-5 text-center text-sm font-extrabold tabular-nums">
                {inCart}
              </span>
              <button
                type="button"
                aria-label="Sumar uno"
                disabled={inCart >= maxQty}
                title={inCart >= maxQty ? `Máximo ${maxQty} por producto` : undefined}
                onClick={(event) => {
                  stop(event);
                  setQuantity(product.slug, inCart + 1);
                }}
                className="grid h-8 w-7 place-items-center rounded-r-full sm:h-9 sm:w-8 text-base font-bold transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:text-white/40 disabled:hover:bg-transparent"
              >
                +
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={outOfStock}
              onClick={addToCart}
              aria-label="Agregar al carrito"
              title={outOfStock ? "Sin stock" : "Agregar al carrito"}
              className="relative z-10 ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-700 sm:h-9 sm:w-9 text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-ink-200 disabled:text-ink-400"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="9" cy="20" r="1.5" />
                <circle cx="17" cy="20" r="1.5" />
                <path d="M2.5 3.5h2l2.6 12.5a1 1 0 001 .8h8.7a1 1 0 001-.8L20.5 7H6" />
              </svg>
            </button>
          )}
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
export function ProductRow({ products, label, badges }: { products: ProductView[]; label: string; badges?: (string | undefined)[] }) {
  // Referencia normal y no un estado: la tira no se vuelve a pintar cuando el
  // nodo se monta o se desmonta, y `move` lee el nodo por `ref.current`.
  const ref = useRef<HTMLDivElement | null>(null);
  // Extremos de la tira, para apagar la flecha que no tiene a dónde ir. Arranca
  // "al inicio" y "no al final", que es lo que se ve antes de medir.
  const [enInicio, setEnInicio] = useState(true);
  const [enFinal, setEnFinal] = useState(false);

  useEffect(() => {
    const tira = ref.current;
    if (!tira) return;
    let cuadro = 0;
    const medir = () => {
      if (cuadro) return;
      cuadro = requestAnimationFrame(() => {
        cuadro = 0;
        setEnInicio(tira.scrollLeft <= 1);
        setEnFinal(tira.scrollLeft + tira.clientWidth >= tira.scrollWidth - 1);
      });
    };
    medir();
    tira.addEventListener("scroll", medir, { passive: true });
    window.addEventListener("resize", medir);
    return () => {
      tira.removeEventListener("scroll", medir);
      window.removeEventListener("resize", medir);
      if (cuadro) cancelAnimationFrame(cuadro);
    };
  }, []);

  // Una tarjeta y algo por clic: se ve que avanzó sin perder de vista la anterior.
  const move = (dir: -1 | 1) => {
    const tira = ref.current;
    if (!tira) return;
    const tarjeta = tira.firstElementChild as HTMLElement | null;
    const paso = tarjeta ? tarjeta.offsetWidth * 2 : 280;
    tira.scrollBy({ left: dir * paso, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div
        ref={ref}
        className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto scroll-smooth px-4 pb-2 sm:gap-3 md:mx-0 md:scroll-px-0 md:px-0"
      >
        {products.map((product, index) => (
          // En el celular entran dos tarjetas y media: se ve que hay más a la derecha.
          <div key={product.slug} className="w-[148px] shrink-0 snap-start sm:w-[190px] md:w-[228px]">
            <ProductCard product={product} badge={badges?.[index]} />
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => move(-1)}
        disabled={enInicio}
        aria-label={`Ver productos anteriores de ${label}`}
        className={`absolute -left-3 top-[38%] hidden h-10 w-10 place-items-center rounded-full border border-ink-100 bg-surface text-ink-700 shadow-md transition hover:bg-brand-50 hover:text-brand-700 md:grid ${
          enInicio ? "pointer-events-none opacity-0" : ""
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => move(1)}
        disabled={enFinal}
        aria-label={`Ver más productos de ${label}`}
        className={`absolute -right-3 top-[38%] hidden h-10 w-10 place-items-center rounded-full border border-ink-100 bg-surface text-ink-700 shadow-md transition hover:bg-brand-50 hover:text-brand-700 md:grid ${
          enFinal ? "pointer-events-none opacity-0" : ""
        }`}
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
    <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.slug} product={product} />
      ))}
    </div>
  );
}
