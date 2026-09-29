"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCallback, useState } from "react";

import { money } from "@/lib/format";

type Category = { slug: string; name: string; icon: string; path?: string; count?: number };
type BrandFacet = { brand: string; count: number };

/** Rangos en pesos enteros, igual que `products.price` (ver `lib/format.ts`). */
const PRICE_BUCKETS = [
  { label: "Hasta $100.000", min: undefined, max: 100_000 },
  { label: "$100.000 a $500.000", min: 100_000, max: 500_000 },
  { label: "$500.000 a $1.000.000", min: 500_000, max: 1_000_000 },
  { label: "Más de $1.000.000", min: 1_000_000, max: undefined },
];

export const SORT_LIST = [
  { id: "relevancia", label: "Más relevantes" },
  { id: "precio-asc", label: "Menor precio" },
  { id: "precio-desc", label: "Mayor precio" },
  { id: "descuento", label: "Mayor descuento" },
  { id: "vendidos", label: "Más vendidos" },
  { id: "puntaje", label: "Mejor puntaje" },
];

function useFilterNav(basePath = "/productos") {
  const router = useRouter();
  const params = useSearchParams();

  return useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      });
      next.delete("pagina");
      const qs = next.toString();
      router.push(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    },
    [params, router, basePath],
  );
}

export function SortSelect({ value, basePath = "/productos" }: { value: string; basePath?: string }) {
  const update = useFilterNav(basePath);
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="hidden text-ink-500 sm:inline">Ordenar por</span>
      <select
        value={value}
        onChange={(e) => update({ orden: e.target.value })}
        className="h-10 rounded-xl border border-ink-200 bg-surface px-3 text-sm font-semibold text-ink-800 outline-none focus:border-brand-400"
      >
        {SORT_LIST.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ActiveFilters({
  chips,
  basePath = "/productos",
}: {
  chips: { key: string; label: string; value: string | null }[];
  basePath?: string;
}) {
  const update = useFilterNav(basePath);
  const router = useRouter();
  if (!chips.length) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          key={`${chip.key}-${chip.label}`}
          type="button"
          onClick={() => update({ [chip.key]: chip.value })}
          className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
        >
          {chip.label}
          <span className="text-brand-600">×</span>
        </button>
      ))}
      <button
        type="button"
        onClick={() => router.push(basePath)}
        className="text-xs font-semibold text-ink-400 underline-offset-2 hover:text-ink-700 hover:underline"
      >
        Limpiar todo
      </button>
    </div>
  );
}

export function FiltersPanel({
  categories,
  brands,
  current,
  basePath = "/productos",
}: {
  categories: Category[];
  brands: BrandFacet[];
  current: {
    categoria?: string;
    marcas: string[];
    min?: number;
    max?: number;
    ofertas: boolean;
    stock: boolean;
  };
  basePath?: string;
}) {
  const update = useFilterNav(basePath);
  const [open, setOpen] = useState(false);

  const toggleBrand = (brand: string) => {
    const set = new Set(current.marcas);
    if (set.has(brand)) set.delete(brand);
    else set.add(brand);
    update({ marca: set.size ? Array.from(set).join(",") : null });
  };

  const body = (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-ink-400">Categoría</h3>
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => update({ categoria: null })}
            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition ${
              !current.categoria ? "bg-brand-50 font-bold text-brand-700" : "text-ink-600 hover:bg-ink-50"
            }`}
          >
            🗂️ Todas las categorías
          </button>
          {categories.map((c) =>
            c.path ? (
              <Link
                key={c.slug}
                href={`/categoria/${c.path}`}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-ink-600 transition hover:bg-ink-50"
              >
                <span>{c.icon}</span>
                <span className="flex-1">{c.name}</span>
                {typeof c.count === "number" ? (
                  <span className="text-[11px] text-ink-300">{c.count}</span>
                ) : null}
              </Link>
            ) : (
              <button
                key={c.slug}
                type="button"
                onClick={() => update({ categoria: current.categoria === c.slug ? null : c.slug })}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                  current.categoria === c.slug
                    ? "bg-brand-50 font-bold text-brand-700"
                    : "text-ink-600 hover:bg-ink-50"
                }`}
              >
                <span>{c.icon}</span>
                {c.name}
              </button>
            ),
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-ink-400">Marca</h3>
        <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
          {brands.map((b) => (
            <label
              key={b.brand}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-ink-600 transition hover:bg-ink-50"
            >
              <input
                type="checkbox"
                checked={current.marcas.includes(b.brand)}
                onChange={() => toggleBrand(b.brand)}
                className="h-4 w-4 rounded border-ink-300 text-brand-600 accent-brand-600"
              />
              <span className="flex-1">{b.brand}</span>
              <span className="text-[11px] text-ink-300">{b.count}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-ink-400">Precio</h3>
        <div className="space-y-1">
          {PRICE_BUCKETS.map((bucket) => {
            const active = current.min === bucket.min && current.max === bucket.max;
            return (
              <button
                key={bucket.label}
                type="button"
                onClick={() =>
                  update({
                    min: active || !bucket.min ? null : String(bucket.min),
                    max: active || !bucket.max ? null : String(bucket.max),
                  })
                }
                className={`block w-full rounded-lg px-2.5 py-2 text-left text-sm transition ${
                  active ? "bg-brand-50 font-bold text-brand-700" : "text-ink-600 hover:bg-ink-50"
                }`}
              >
                {bucket.label}
              </button>
            );
          })}
        </div>
        {current.min || current.max ? (
          <p className="mt-2 text-[11px] text-ink-400">
            Filtrando {current.min ? `desde ${money(current.min)}` : ""} {current.max ? `hasta ${money(current.max)}` : ""}
          </p>
        ) : null}
      </div>

      <div>
        <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-ink-400">Beneficios</h3>
        <div className="space-y-1.5">
          {[
            { key: "ofertas", label: "🔥 Solo ofertas", active: current.ofertas },
            { key: "stock", label: "✅ Disponible ya", active: current.stock },
          ].map((filter) => (
            <label
              key={filter.key}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-ink-600 transition hover:bg-ink-50"
            >
              <input
                type="checkbox"
                checked={filter.active}
                onChange={() => update({ [filter.key]: filter.active ? null : "1" })}
                className="h-4 w-4 rounded border-ink-300 accent-brand-600"
              />
              {filter.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 items-center gap-2 rounded-xl border border-ink-200 bg-surface px-4 text-sm font-bold text-ink-700 lg:hidden"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
        </svg>
        Filtros
      </button>

      <aside className="hidden lg:block">
        <div className="card-surface sticky top-36 p-5">{body}</div>
      </aside>

      {open ? (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-deep/50" onClick={() => setOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] animate-pop overflow-y-auto rounded-t-3xl bg-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">Filtros</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-2xl text-ink-400">
                ×
              </button>
            </div>
            {body}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-6 w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white"
            >
              Ver resultados
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
