"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { ArrowRight, History } from "lucide-react";

import { ProductCard, ProductRow } from "@/components/product-card";
import { useStore } from "@/components/store-provider";
import { Spinner } from "@/components/ui";
import type { ProductView } from "@/lib/product-view";

/**
 * Bloques de la home que necesitan el navegador: lo que miró cada visitante,
 * las pestañas por categoría y la grilla que carga más productos. Los datos
 * iniciales vienen del servidor; lo demás sale de `/api/productos`.
 */

/**
 * "Seguí donde lo dejaste": los últimos productos que abrió esta persona (la
 * ficha los guarda en el navegador). Para quien entra por primera vez no se
 * dibuja nada, así que no suma ruido.
 */
export function HomeRecentlyViewed() {
  const { recentlyViewed, hydrated, clearRecent } = useStore();
  const [products, setProducts] = useState<ProductView[]>([]);
  const key = recentlyViewed.join(",");

  useEffect(() => {
    if (!hydrated || !key) return;
    const controller = new AbortController();
    fetch(`/api/productos?slugs=${encodeURIComponent(key)}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { products: [] }))
      .then((data: { products?: ProductView[] }) => setProducts(data.products ?? []))
      .catch(() => {
        /* Sin red no se muestra el bloque. */
      });
    return () => controller.abort();
  }, [hydrated, key]);

  if (!key || !products.length) return null;

  return (
    <section aria-labelledby="vistos-titulo" className="container-xl pt-5 sm:pt-10">
      <div className="mb-3 flex items-end justify-between gap-3 sm:mb-5">
        <div className="min-w-0">
          <p className="hidden items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-700 sm:inline-flex">
            <History size={13} aria-hidden /> Vistos recientemente
          </p>
          <h2 id="vistos-titulo" className="text-lg font-extrabold leading-tight tracking-tight text-ink-900 sm:mt-1 sm:text-3xl">
            Seguí donde lo dejaste
          </h2>
        </div>
        <button
          type="button"
          onClick={() => {
            clearRecent();
            setProducts([]);
          }}
          className="shrink-0 pb-1 text-xs font-semibold text-ink-500 transition hover:text-ink-900 sm:text-sm"
        >
          Borrar historial
        </button>
      </div>
      <ProductRow products={products} label="los vistos recientemente" />
    </section>
  );
}

export type CategoryShowcaseTab = { name: string; path: string; count: number; products: ProductView[] };

/**
 * "Explorá por categoría": una pestaña por categoría principal y su fila de
 * productos. Todo viene del servidor, así que cambiar de pestaña es inmediato.
 */
export function HomeCategoryTabs({ tabs }: { tabs: CategoryShowcaseTab[] }) {
  const [active, setActive] = useState(0);
  const id = useId();
  const current = tabs[active] ?? tabs[0];
  if (!current) return null;

  return (
    <section aria-labelledby={`${id}-titulo`} className="container-xl py-5 sm:py-10">
      <p className="hidden text-[11px] font-bold uppercase tracking-[0.18em] text-brand-700 sm:block">Mirá sin salir de acá</p>
      <h2 id={`${id}-titulo`} className="text-lg font-extrabold leading-tight tracking-tight text-ink-900 sm:mt-1 sm:text-3xl">
        Explorá por categoría
      </h2>
      <div
        role="tablist"
        aria-label="Categorías"
        className="no-scrollbar -mx-4 mb-3 mt-2.5 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mb-5 sm:mt-4 sm:gap-2 md:mx-0 md:flex-wrap md:px-0"
      >
        {tabs.map((tab, index) => {
          const selected = index === active;
          return (
            <button
              key={tab.path}
              type="button"
              role="tab"
              id={`${id}-tab-${index}`}
              aria-selected={selected}
              aria-controls={`${id}-panel`}
              onClick={() => setActive(index)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-bold transition sm:px-4 sm:py-2 sm:text-sm ${
                selected ? "bg-ink-900 text-white" : "bg-surface text-ink-700 ring-1 ring-black/5 hover:bg-brand-50 hover:text-brand-700"
              }`}
            >
              {tab.name}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${active}`}>
        <ProductRow key={current.path} products={current.products} label={current.name} />
        <Link
          href={`/categoria/${current.path}`}
          className="group mt-3 inline-flex items-center gap-1.5 text-[13px] font-bold text-brand-700 hover:text-brand-800 sm:mt-4 sm:text-sm"
        >
          Ver {current.count} productos en {current.name}
          <ArrowRight size={14} className="transition group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

/**
 * "Seguí explorando": grilla al final de la home con un botón que trae la
 * página siguiente del catálogo, para que la home no termine en seco.
 */
export function HomeExplore({ initial, total, hasMore: initialHasMore }: { initial: ProductView[]; total: number; hasMore: boolean }) {
  const [products, setProducts] = useState(initial);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function loadMore() {
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/productos?pagina=${page + 1}`);
      const data = (await res.json()) as { products?: ProductView[]; hasMore?: boolean };
      if (!res.ok || !data.products) throw new Error("sin datos");
      setProducts((prev) => {
        const seen = new Set(prev.map((p) => p.slug));
        return [...prev, ...data.products!.filter((p) => !seen.has(p.slug))];
      });
      setPage((p) => p + 1);
      setHasMore(Boolean(data.hasMore));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  if (!products.length) return null;

  return (
    <section aria-labelledby="explorar-titulo" className="container-xl py-5 sm:py-10">
      <p className="hidden text-[11px] font-bold uppercase tracking-[0.18em] text-brand-700 sm:block">Hay más para ver</p>
      <h2 id="explorar-titulo" className="mb-3 text-lg font-extrabold leading-tight tracking-tight text-ink-900 sm:mb-6 sm:mt-1 sm:text-3xl">
        Seguí explorando
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
        {products.map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
      </div>
      <div className="mt-5 flex flex-col items-center gap-2 text-center sm:mt-8">
        <p className="text-xs text-ink-500" aria-live="polite">
          Mostrando {products.length} de {total} productos
        </p>
        {hasMore ? (
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="inline-flex min-w-[220px] items-center justify-center gap-2 rounded-full bg-ink-900 px-6 py-3 text-sm font-bold text-white transition hover:bg-ink-700 disabled:opacity-70"
          >
            {loading ? <Spinner className="h-4 w-4" /> : null}
            {loading ? "Cargando…" : "Ver más productos"}
          </button>
        ) : (
          <Link
            href="/productos"
            className="inline-flex min-w-[220px] items-center justify-center gap-1.5 rounded-full bg-ink-900 px-6 py-3 text-sm font-bold text-white transition hover:bg-ink-700"
          >
            Ver todo el catálogo <ArrowRight size={14} aria-hidden />
          </Link>
        )}
        {failed ? <p role="alert" className="text-xs font-semibold text-red-600">No se pudieron cargar más. Probá de nuevo.</p> : null}
      </div>
    </section>
  );
}
