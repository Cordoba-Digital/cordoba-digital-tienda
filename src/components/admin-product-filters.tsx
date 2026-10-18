"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import type { AdminCategoryOption } from "@/lib/admin-products";
import type { PhotoFilter } from "@/lib/photo-checks";
import { groupCategoryOptions } from "@/lib/category-tree";

type Props = {
  q: string;
  category: string;
  categories: AdminCategoryOption[];
  stock: "" | "con" | "sin";
  sort: "" | "stock-desc" | "stock-asc";
  oferta: boolean;
  destacados: boolean;
  fotos: PhotoFilter;
};

export const PHOTO_FILTER_LABELS: Record<Exclude<PhotoFilter, "">, string> = {
  sin: "Sin foto",
  chicas: "Fotos chicas",
  marcadas: "Marcadas para cambiar",
  "sin-medir": "Fotos sin medir",
};

/** Filtros de la lista: se aplican solos al cambiar, sin botón Buscar. */
export const LAST_LIST_KEY = "admin:productos:lista";

export function AdminProductFilters({ q, category, categories, stock, sort, oferta, destacados, fotos }: Props) {
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
    "h-11 !rounded-full border border-ink-200 bg-surface px-4 text-sm text-ink-900 outline-none transition-[background-color,color,border-color,box-shadow,opacity] duration-150 focus:border-ink-400";
  const chip = (on: boolean) =>
    `h-11 flex-1 rounded-full border px-4 text-sm transition-[background-color,color,border-color,box-shadow,opacity] duration-150 sm:flex-none ${
      on ? "border-brand-500/50 bg-brand-500/15 text-adm-accent" : "border-adm-fg/10 bg-adm-fg/[0.05] text-adm-soft hover:bg-adm-fg/[0.09]"
    }`;

  // Filtros puestos, como pastillas con una cruz para sacar cada uno.
  const active: { key: string; label: string; value: string; clear: Record<string, string | null> }[] = [];
  if (q) active.push({ key: "q", label: "Búsqueda", value: q, clear: { q: null } });
  if (category) {
    const name = categories.find((c) => c.slug === category)?.name.split(" › ").pop() ?? category;
    active.push({ key: "categoria", label: "Categoría", value: name, clear: { categoria: null } });
  }
  if (stock) active.push({ key: "stock", label: "Stock", value: stock === "sin" ? "Sin stock" : "Con stock", clear: { stock: null } });
  if (sort) active.push({ key: "orden", label: "Orden", value: sort === "stock-desc" ? "Más stock primero" : "Menos stock primero", clear: { orden: null } });
  if (oferta) active.push({ key: "oferta", label: "Precio", value: "En oferta", clear: { oferta: null } });
  if (destacados) active.push({ key: "destacados", label: "Vitrina", value: "Destacados", clear: { destacados: null } });
  if (fotos) active.push({ key: "fotos", label: "Fotos", value: PHOTO_FILTER_LABELS[fotos], clear: { fotos: null } });

  return (
    <div className={`flex flex-col gap-3 transition-opacity ${pending ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 basis-full sm:basis-64 sm:flex-1">
          <svg viewBox="0 0 24 24" aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5-2 4 4" />
          </svg>
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Buscar por nombre, SKU o marca"
            aria-label="Buscar productos"
            className={`${control} w-full pl-10`}
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
        <select
          value={fotos}
          onChange={(e) => apply({ fotos: e.target.value || null })}
          aria-label="Fotos"
          className={`${control} flex-1 sm:flex-none`}
        >
          <option value="">Todas las fotos</option>
          {Object.entries(PHOTO_FILTER_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
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
      {active.length ? (
        <div className="flex flex-wrap items-center gap-2">
          {active.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => {
                if (f.key === "q") {
                  lastPushed.current = "";
                  setText("");
                }
                apply(f.clear);
              }}
              aria-label={`Sacar el filtro ${f.label}: ${f.value}`}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-adm-fg/10 bg-adm-fg/[0.05] px-3.5 text-[13px] text-adm-muted hover:bg-adm-fg/[0.09]"
            >
              {f.label}
              <span className="text-adm-fg">{f.value}</span>
              <span aria-hidden className="text-adm-muted">✕</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              lastPushed.current = "";
              setText("");
              apply({ q: null, categoria: null, stock: null, orden: null, oferta: null, destacados: null });
            }}
            className="px-2 text-[13px] text-adm-muted hover:text-adm-fg"
          >
            Limpiar filtros
          </button>
        </div>
      ) : null}
    </div>
  );
}
