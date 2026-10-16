"use client";

import { useState } from "react";

import type { HeroSettings, HeroSlideId } from "@/lib/hero-picks";
import type { HeroAdminProduct, HeroAdminState } from "@/lib/hero-picks-server";

const fmt = new Intl.NumberFormat("es-AR");

type SearchRow = { slug: string; name: string; image: string; price: number; stock: number };

function Thumb({ product }: { product: HeroAdminProduct }) {
  return product.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={product.image} alt="" className="h-12 w-12 shrink-0 rounded-lg border border-ink-100 bg-white object-contain" />
  ) : (
    <span aria-hidden="true" className="h-12 w-12 shrink-0 rounded-lg border border-ink-100 bg-ink-50" />
  );
}

/**
 * Productos del carrusel de la portada: qué va hoy en cada slide, fijar otro a
 * mano, volver a automático y sacar productos. Cada cambio se guarda enseguida.
 */
export function AdminHeroPicks({ initial }: { initial: HeroAdminState }) {
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [choosing, setChoosing] = useState<HeroSlideId | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchRow[]>([]);
  const [searching, setSearching] = useState(false);

  async function save(next: HeroSettings): Promise<boolean> {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/portada", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; state?: HeroAdminState };
      if (!res.ok || !data.ok || !data.state) {
        setError(data.error ?? "No se pudo guardar.");
        return false;
      }
      setState(data.state);
      return true;
    } catch {
      setError("Error de red. Probá de nuevo.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const settings = state.settings;

  function pin(id: HeroSlideId, slug: string) {
    void save({ pinned: { ...settings.pinned, [id]: slug }, excluded: settings.excluded.filter((s) => s !== slug) }).then((ok) => {
      if (ok) closeSearch();
    });
  }

  function unpin(id: HeroSlideId) {
    const pinned = { ...settings.pinned };
    delete pinned[id];
    void save({ pinned, excluded: settings.excluded });
  }

  function exclude(slug: string) {
    const pinned = Object.fromEntries(Object.entries(settings.pinned).filter(([, s]) => s !== slug));
    void save({ pinned, excluded: [...settings.excluded, slug] });
  }

  function allow(slug: string) {
    void save({ pinned: settings.pinned, excluded: settings.excluded.filter((s) => s !== slug) });
  }

  function closeSearch() {
    setChoosing(null);
    setQuery("");
    setResults([]);
  }

  async function search(text: string) {
    setQuery(text);
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const params = new URLSearchParams({ q: text.trim(), stock: "con", perPage: "6" });
      const res = await fetch(`/api/admin/products?${params}`);
      const data = (await res.json().catch(() => ({}))) as { items?: SearchRow[] };
      setResults(data.items ?? []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  return (
    <section aria-labelledby="portada-titulo" className="space-y-3">
      <div>
        <h2 id="portada-titulo" className="text-lg font-semibold tracking-[-0.01em] text-ink-900">
          Productos de la portada
        </h2>
        <p className="mt-0.5 max-w-2xl text-sm text-ink-500">
          {state.auto
            ? "Cada slide elige su producto solo. Si querés uno en particular, fijalo; si hay uno que no querés ver, sacalo."
            : "La elección automática está apagada: los slides muestran los productos más nuevos. Igual podés fijar o sacar productos."}
        </p>
      </div>
      {error ? <p role="alert" className="text-sm font-semibold text-red-600">{error}</p> : null}
      <ul className="admin-card divide-y divide-ink-100">
        {state.slides.map((slide) => (
          <li key={slide.id} className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-full shrink-0 sm:w-44">
                <p className="text-sm font-bold text-ink-900">{slide.label}</p>
                {state.auto ? <p className="mt-0.5 text-xs text-ink-500">{slide.rule}</p> : null}
              </div>
              {slide.pick ? (
                <div className="flex min-w-0 basis-full items-center gap-3 sm:basis-0 sm:flex-1">
                  <Thumb product={slide.pick} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-900">{slide.pick.name}</p>
                    <p className="text-xs text-ink-500">
                      ${fmt.format(slide.pick.price)} ·{" "}
                      <span className={slide.pick.source === "fijado" ? "font-bold text-brand-700" : ""}>
                        {slide.pick.source === "fijado" ? "Fijado por vos" : "Elegido solo"}
                      </span>
                    </p>
                  </div>
                </div>
              ) : (
                <p className="basis-full text-sm text-ink-500 sm:basis-0 sm:flex-1">Sin producto: no hay ninguno con stock y foto que encaje.</p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => (choosing === slide.id ? closeSearch() : setChoosing(slide.id))}
                  className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-bold text-ink-700 hover:bg-ink-50 disabled:opacity-60"
                >
                  {choosing === slide.id ? "Cancelar" : "Fijar otro"}
                </button>
                {settings.pinned[slide.id] ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => unpin(slide.id)}
                    className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-bold text-ink-700 hover:bg-ink-50 disabled:opacity-60"
                  >
                    Volver a automático
                  </button>
                ) : null}
                {slide.pick ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => exclude(slide.pick!.slug)}
                    className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-ink-50 disabled:opacity-60"
                  >
                    No mostrar este
                  </button>
                ) : null}
              </div>
            </div>
            {slide.pinnedUnavailable ? (
              <p className="text-xs font-semibold text-amber-700">
                Fijaste “{slide.pinnedUnavailable.name}”, pero no tiene stock o foto: mientras tanto se muestra otro.
              </p>
            ) : null}
            {choosing === slide.id ? (
              <div className="space-y-2">
                <input
                  type="search"
                  autoFocus
                  value={query}
                  onChange={(event) => void search(event.target.value)}
                  placeholder="Buscá el producto por nombre o SKU"
                  aria-label={`Buscar producto para el slide ${slide.label}`}
                  className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900"
                />
                {searching ? <p className="text-xs text-ink-500">Buscando…</p> : null}
                {!searching && query.trim().length >= 2 && results.length === 0 ? (
                  <p className="text-xs text-ink-500">No hay productos con stock con ese nombre.</p>
                ) : null}
                <ul className="space-y-1">
                  {results.map((row) => (
                    <li key={row.slug}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => pin(slide.id, row.slug)}
                        className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-ink-50 disabled:opacity-60"
                      >
                        <Thumb product={row} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-ink-900">{row.name}</span>
                          <span className="text-xs text-ink-500">
                            ${fmt.format(row.price)} · stock {row.stock}
                          </span>
                        </span>
                        <span className="text-xs font-bold text-brand-700">Fijar</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {state.excluded.length ? (
        <div className="admin-card space-y-2 p-4">
          <p className="text-sm font-bold text-ink-900">Sacados de la portada</p>
          <ul className="flex flex-wrap gap-2">
            {state.excluded.map((product) => (
              <li key={product.slug} className="flex items-center gap-2 rounded-lg border border-ink-200 py-1 pr-1 pl-3 text-xs text-ink-700">
                <span className="max-w-56 truncate">{product.name}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => allow(product.slug)}
                  aria-label={`Volver a permitir ${product.name}`}
                  className="rounded-md px-2 py-1 font-bold text-brand-700 hover:bg-ink-50 disabled:opacity-60"
                >
                  Volver a permitir
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
