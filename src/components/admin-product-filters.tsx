"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import type { AdminCategoryOption } from "@/lib/admin-products";
import { groupCategoryOptions } from "@/lib/category-tree";

type Props = {
  q: string;
  category: string;
  categories: AdminCategoryOption[];
  stock: "" | "con" | "sin";
  sort: "" | "stock-desc" | "stock-asc";
  oferta: boolean;
  destacados: boolean;
};

/** Filtros de la lista: se aplican solos al cambiar, sin botón Buscar. */
export const LAST_LIST_KEY = "admin:productos:lista";

export function AdminProductFilters({ q, category, categories, stock, sort, oferta, destacados }: Props) {
  const router = useRouter();
  const pathname = usePathname() ?? "/admin/productos";
  const searchParams = useSearchParams();

  // Recuerda la lista tal cual (filtros, orden, página) para el "← Volver" de editar.
  const listUrl = `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`;
  useEffect(() => {
    try {
      sessionStorage.setItem(LAST_LIST_KEY, listUrl);
    } catch {}
  }, [listUrl]);
  const [text, setText] = useState(q);
  const [pending, startTransition] = useTransition();
  const lastPushed = useRef(q);

  function apply(changes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete("sinStock");
    params.delete("page");
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  // La búsqueda espera a que se deje de tipear.
  useEffect(() => {
    const value = text.trim();
    if (value === lastPushed.current) return;
    const timer = window.setTimeout(() => {
      lastPushed.current = value;
      apply({ q: value || null });
    }, 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const control =
    "h-10 border border-ink-200 bg-surface px-3 text-sm text-ink-900 outline-none transition-[background-color,color,border-color,box-shadow,opacity] duration-150 focus:border-ink-400";
  const chip = (on: boolean) =>
    `h-10 flex-1 border px-4 text-sm font-semibold transition-[background-color,color,border-color,box-shadow,opacity] duration-150 sm:flex-none ${
      on ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200 bg-surface text-ink-600 hover:border-ink-300 hover:text-ink-900"
    }`;

  return (
    <div className={`flex flex-wrap items-center gap-2 transition-opacity ${pending ? "opacity-60" : ""}`}>
      <div className="relative min-w-0 basis-full sm:basis-64 sm:flex-1">
        <svg viewBox="0 0 24 24" aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5-2 4 4" />
        </svg>
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Buscar por nombre, SKU o marca"
          aria-label="Buscar productos"
          className={`${control} w-full pl-9`}
        />
      </div>
      <select
        value={category}
        onChange={(e) => apply({ categoria: e.target.value || null })}
        aria-label="Categoría"
        className={`${control} min-w-0 flex-1 sm:max-w-56 sm:flex-none`}
      >
        <option value="">Todas las categorías</option>
        {groupCategoryOptions(categories).map(({ group, items }) => (
          <optgroup key={group} label={group}>
            {items.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <select
        value={stock}
        onChange={(e) => apply({ stock: e.target.value || null })}
        aria-label="Stock"
        className={`${control} flex-1 sm:flex-none`}
      >
        <option value="">Todo el stock</option>
        <option value="con">Con stock</option>
        <option value="sin">Sin stock</option>
      </select>
      <select
        value={sort}
        onChange={(e) => apply({ orden: e.target.value || null })}
        aria-label="Ordenar"
        className={`${control} basis-full sm:basis-auto`}
      >
        <option value="">Más recientes</option>
        <option value="stock-desc">Más stock primero</option>
        <option value="stock-asc">Menos stock primero</option>
      </select>
      <button type="button" aria-pressed={oferta} onClick={() => apply({ oferta: oferta ? null : "1" })} className={chip(oferta)}>
        En oferta
      </button>
      <button
        type="button"
        aria-pressed={destacados}
        onClick={() => apply({ destacados: destacados ? null : "1" })}
        className={chip(destacados)}
      >
        Destacados
      </button>
    </div>
  );
}
