"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AdminProductRow } from "@/components/admin-product-row";
import type { AdminProductRow as Row } from "@/lib/admin-products";

/**
 * Lista de productos del panel sin páginas: el servidor manda la primera tanda
 * y las siguientes se piden a /api/admin/products al acercarse al final.
 * Cuando cambian los filtros la página la vuelve a montar (key = filtros).
 */
export function AdminProductList({
  initialItems,
  total,
  perPage,
  query,
}: {
  initialItems: Row[];
  total: number;
  perPage: number;
  /** Filtros actuales como query string, sin `page` (ej. "q=iphone&stock=con"). */
  query: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const sentinel = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const done = items.length >= total || (page > 1 && items.length < page * perPage);

  const loadMore = useCallback(async () => {
    if (busy.current || done) return;
    busy.current = true;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams(query);
      params.set("page", String(page + 1));
      params.set("perPage", String(perPage));
      const res = await fetch(`/api/admin/products?${params}`, { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; items?: Row[]; error?: string } | null;
      if (!res.ok || !data?.ok || !data.items) throw new Error(data?.error || "No se pudieron cargar más productos.");
      const fresh = data.items;
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.slug));
        return [...prev, ...fresh.filter((p) => !seen.has(p.slug))];
      });
      setPage((p) => p + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar más productos.");
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [done, page, perPage, query]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || done || error) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      // Pide la próxima tanda un poco antes de llegar al final, así no se nota la espera.
      { rootMargin: "800px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [done, error, loadMore]);

  return (
    <>
      <div className="admin-table" role="table" aria-label="Productos">
        <div
          role="row"
          className="hidden border-b border-ink-100 px-4 py-3 text-xs font-bold uppercase tracking-wide text-ink-500 lg:grid lg:grid-cols-[minmax(0,1fr)_8.5rem_6.5rem_8.5rem_6rem] lg:gap-4"
        >
          <span role="columnheader">Producto</span>
          <span role="columnheader">Precio</span>
          <span role="columnheader">Stock</span>
          <span role="columnheader">Etiqueta</span>
          <span role="columnheader" className="text-right">Acción</span>
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-500">Sin productos para este filtro.</p>
        ) : (
          items.map((p) => <AdminProductRow key={p.slug} product={p} />)
        )}
      </div>

      <div ref={sentinel} className="flex flex-col items-center gap-2 py-2 text-center" aria-live="polite">
        {items.length > 0 ? (
          <p className="text-xs text-ink-500">
            {done ? `Son todos: ${items.length} productos.` : `Mostrando ${items.length} de ${total}.`}
          </p>
        ) : null}
        {loading ? <p className="text-sm font-bold text-ink-600">Cargando más productos…</p> : null}
        {error ? <p className="text-sm font-bold text-red-700">{error}</p> : null}
        {!done && !loading ? (
          <button
            type="button"
            onClick={() => void loadMore()}
            className="border border-ink-200 px-4 py-2 text-xs font-bold text-ink-700 hover:border-brand-300"
          >
            {error ? "Reintentar" : "Cargar más"}
          </button>
        ) : null}
        {done && items.length > 20 ? (
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="text-xs font-bold text-brand-700 hover:underline"
          >
            ↑ Volver arriba
          </button>
        ) : null}
      </div>
    </>
  );
}
