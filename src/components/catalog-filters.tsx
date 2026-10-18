"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { startTransition, useCallback, useEffect, useMemo, useState } from "react";

import { CategoryIcon, Icon } from "@/components/category-icon";
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

const BRANDS_COLLAPSED = 8;

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
      // Transición: con red lenta el click no se siente bloqueado mientras
      // navega, y el select/sort no pierde el foco a mitad de camino.
      startTransition(() => {
        router.push(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
      });
    },
    [params, router, basePath],
  );
}

export function SortSelect({ value, basePath = "/productos" }: { value: string; basePath?: string }) {
  const update = useFilterNav(basePath);
  return (
    <label className="relative flex items-center gap-2 text-sm">
      <span className="hidden text-ink-500 sm:inline">Ordenar por</span>
      <span className="relative">
        <select
          value={value}
          onChange={(e) => update({ orden: e.target.value })}
          className="h-10 appearance-none rounded-xl border border-ink-200 bg-surface pl-3 pr-9 text-sm font-semibold text-ink-800 outline-none transition hover:border-brand-300 focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
        >
          {SORT_LIST.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <Icon name="chevronDown" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
      </span>
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
          aria-label={`Quitar filtro ${chip.label}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 py-1.5 pl-3 pr-2 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
        >
          {chip.label}
          <Icon name="x" className="h-3.5 w-3.5" />
        </button>
      ))}
      <button
        type="button"
        onClick={() => router.push(basePath)}
        className="text-xs font-semibold text-ink-500 underline-offset-2 hover:text-ink-700 hover:underline"
      >
        Limpiar todo
      </button>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-ink-100 pb-5 last:border-0 last:pb-0">
      <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-ink-500">{title}</h3>
      {children}
    </section>
  );
}

const rowBase = "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition";
const rowOn = "bg-brand-50 font-bold text-brand-700";
const rowOff = "text-ink-600 hover:bg-ink-50";

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
  const [brandQuery, setBrandQuery] = useState("");
  const [allBrands, setAllBrands] = useState(false);
  const [minDraft, setMinDraft] = useState(current.min ? String(current.min) : "");
  const [maxDraft, setMaxDraft] = useState(current.max ? String(current.max) : "");

  const activeCount =
    current.marcas.length + (current.min || current.max ? 1 : 0) + (current.ofertas ? 1 : 0) + (current.stock ? 1 : 0);

  // Hoja de filtros en móvil: sin esto la página de atrás scrollea por debajo.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const toggleBrand = (brand: string) => {
    const set = new Set(current.marcas);
    if (set.has(brand)) set.delete(brand);
    else set.add(brand);
    update({ marca: set.size ? Array.from(set).join(",") : null });
  };

  // Las marcas elegidas suben arriba para no perderlas al filtrar la lista.
  const visibleBrands = useMemo(() => {
    const q = brandQuery.trim().toLowerCase();
    const sorted = [...brands].sort(
      (a, b) => Number(current.marcas.includes(b.brand)) - Number(current.marcas.includes(a.brand)),
    );
    const filtered = q ? sorted.filter((b) => b.brand.toLowerCase().includes(q)) : sorted;
    return q || allBrands ? filtered : filtered.slice(0, BRANDS_COLLAPSED);
  }, [brands, brandQuery, allBrands, current.marcas]);

  const applyRange = (e: React.FormEvent) => {
    e.preventDefault();
    const lo = Math.max(0, Math.floor(Number(minDraft) || 0));
    const hi = Math.max(0, Math.floor(Number(maxDraft) || 0));
    const [min, max] = hi && lo > hi ? [hi, lo] : [lo, hi];
    update({ min: min ? String(min) : null, max: max ? String(max) : null });
  };

  const body = (
    <div className="space-y-5">
      {categories.length ? (
        <Group title="Categoría">
          <div className="space-y-0.5">
            <Link href="/productos" className={`${rowBase} ${!current.categoria ? rowOn : rowOff}`}>
              <Icon name="grid" className="h-4 w-4 shrink-0 text-brand-700" />
              Todas las categorías
            </Link>
            {categories.map((c) =>
              c.path ? (
                <Link key={c.slug} href={`/categoria/${c.path}`} className={`${rowBase} ${rowOff}`}>
                  <CategoryIcon name={c.name} className="h-4 w-4 shrink-0 text-brand-700" />
                  <span className="flex-1">{c.name}</span>
                  {typeof c.count === "number" ? (
                    // ink-300 daba 2,19:1 sobre fondo claro: ilegible a 11px.
                    <span className="text-[11px] text-ink-500">{c.count.toLocaleString("es-AR")}</span>
                  ) : null}
                </Link>
              ) : (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => update({ categoria: current.categoria === c.slug ? null : c.slug })}
                  className={`${rowBase} ${current.categoria === c.slug ? rowOn : rowOff}`}
                >
                  <CategoryIcon name={c.name} className="h-4 w-4 shrink-0 text-brand-700" />
                  {c.name}
                </button>
              ),
            )}
          </div>
        </Group>
      ) : null}

      <Group title="Marca">
        {brands.length > BRANDS_COLLAPSED ? (
          <div className="relative mb-2">
            <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              value={brandQuery}
              onChange={(e) => setBrandQuery(e.target.value)}
              placeholder="Buscar marca"
              aria-label="Buscar marca"
              className="h-9 w-full rounded-lg border border-ink-200 bg-ink-50/70 pl-8 pr-2 text-sm text-ink-800 outline-none placeholder:text-ink-400 focus:border-brand-400 focus:bg-surface"
            />
          </div>
        ) : null}
        <div className="space-y-0.5">
          {visibleBrands.map((b) => (
            <label
              key={b.brand}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-ink-600 transition hover:bg-ink-50"
            >
              <input
                type="checkbox"
                checked={current.marcas.includes(b.brand)}
                onChange={() => toggleBrand(b.brand)}
                className="h-4 w-4 rounded border-ink-300 accent-brand-600"
              />
              <span className="flex-1">{b.brand}</span>
              <span className="text-[11px] text-ink-500">{b.count}</span>
            </label>
          ))}
          {visibleBrands.length === 0 ? <p className="px-2.5 py-2 text-xs text-ink-500">Ninguna marca coincide.</p> : null}
        </div>
        {!brandQuery && brands.length > BRANDS_COLLAPSED ? (
          <button
            type="button"
            onClick={() => setAllBrands((v) => !v)}
            className="mt-1.5 px-2.5 text-xs font-bold text-brand-700 hover:underline"
          >
            {allBrands ? "Ver menos" : `Ver las ${brands.length} marcas`}
          </button>
        ) : null}
      </Group>

      <Group title="Precio">
        <div className="space-y-0.5">
          {PRICE_BUCKETS.map((bucket) => {
            const active = current.min === bucket.min && current.max === bucket.max;
            return (
              <button
                key={bucket.label}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  update({
                    min: active || !bucket.min ? null : String(bucket.min),
                    max: active || !bucket.max ? null : String(bucket.max),
                  })
                }
                className={`${rowBase} ${active ? rowOn : rowOff}`}
              >
                {bucket.label}
              </button>
            );
          })}
        </div>
        <form onSubmit={applyRange} className="mt-3 flex items-center gap-1.5">
          <input
            inputMode="numeric"
            value={minDraft}
            onChange={(e) => setMinDraft(e.target.value.replace(/\D/g, ""))}
            placeholder="Mín."
            aria-label="Precio mínimo"
            className="h-9 w-full min-w-0 rounded-lg border border-ink-200 bg-surface px-2.5 text-sm text-ink-800 outline-none placeholder:text-ink-400 focus:border-brand-400"
          />
          <span className="text-ink-500">–</span>
          <input
            inputMode="numeric"
            value={maxDraft}
            onChange={(e) => setMaxDraft(e.target.value.replace(/\D/g, ""))}
            placeholder="Máx."
            aria-label="Precio máximo"
            className="h-9 w-full min-w-0 rounded-lg border border-ink-200 bg-surface px-2.5 text-sm text-ink-800 outline-none placeholder:text-ink-400 focus:border-brand-400"
          />
          <button
            type="submit"
            aria-label="Aplicar rango de precio"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-700 text-white transition hover:bg-brand-800"
          >
            <Icon name="check" className="h-4 w-4" />
          </button>
        </form>
        {current.min || current.max ? (
          <p className="mt-2 text-[11px] text-ink-500">
            Filtrando {current.min ? `desde ${money(current.min)}` : ""} {current.max ? `hasta ${money(current.max)}` : ""}
          </p>
        ) : null}
      </Group>

      <Group title="Beneficios">
        <div className="space-y-0.5">
          {[
            { key: "ofertas", label: "Solo ofertas", icon: "flame", active: current.ofertas },
            { key: "stock", label: "Disponible ya", icon: "check", active: current.stock },
          ].map((filter) => (
            <label
              key={filter.key}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-3 text-sm text-ink-600 transition hover:bg-ink-50"
            >
              <input
                type="checkbox"
                checked={filter.active}
                onChange={() => update({ [filter.key]: filter.active ? null : "1" })}
                className="h-4 w-4 rounded border-ink-300 accent-brand-600"
              />
              <Icon name={filter.icon} className="h-4 w-4 text-brand-700" />
              {filter.label}
            </label>
          ))}
        </div>
      </Group>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 items-center gap-2 rounded-xl border border-ink-200 bg-surface px-4 text-sm font-bold text-ink-700 transition hover:border-brand-300 lg:hidden"
      >
        <Icon name="sliders" className="h-4 w-4" />
        Filtros
        {activeCount > 0 ? (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-700 px-1 text-[11px] font-bold text-white">
            {activeCount}
          </span>
        ) : null}
      </button>

      <aside className="hidden lg:block">
        {/* Entero y sin scroll propio: acompaña el scroll de la página. */}
        <div className="card-surface p-5">{body}</div>
      </aside>

      {open ? (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Filtros">
          <div className="absolute inset-0 bg-deep/50" onClick={() => setOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 flex max-h-[88vh] animate-pop flex-col rounded-t-3xl bg-surface">
            <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
              <h2 className="text-lg font-extrabold text-ink-900">Filtros</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar filtros"
                className="grid h-9 w-9 place-items-center rounded-full text-ink-500 hover:bg-ink-50"
              >
                <Icon name="x" className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto overscroll-contain data-lenis-prevent px-5 py-5">{body}</div>
            <div className="border-t border-ink-100 p-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white hover:bg-brand-800"
              >
                Ver resultados
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
