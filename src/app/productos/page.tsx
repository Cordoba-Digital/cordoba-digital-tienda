import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ActiveFilters, FiltersPanel, SortSelect } from "@/components/catalog-filters";
import { ProductCard } from "@/components/product-card";
import { money } from "@/lib/format";
import { toView } from "@/lib/product-view";
import { getBrandFacets, getCategoryTree, listProducts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Catálogo de tecnología",
  description:
    "Celulares, notebooks, cámaras, drones, gaming y más con stock real, envío a todo el país y 15% OFF con transferencia.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pick(params: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const value = params[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function CatalogPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = pick(params, "q");
  const marcaParam = pick(params, "marca");
  const marcas = marcaParam ? marcaParam.split(",").filter(Boolean) : [];
  const min = pick(params, "min") ? Number(pick(params, "min")) : undefined;
  const max = pick(params, "max") ? Number(pick(params, "max")) : undefined;
  const orden = pick(params, "orden") ?? "relevancia";
  const pagina = Number(pick(params, "pagina") ?? "1");
  const ofertas = pick(params, "ofertas") === "1";
  const envio = pick(params, "envio") === "1";
  const stock = pick(params, "stock") === "1";

  const [categories, brands, result] = await Promise.all([
    getCategoryTree(),
    getBrandFacets(),
    listProducts({
      q,
      brands: marcas,
      min,
      max,
      sort: orden,
      page: pagina,
      perPage: 24,
      onlyOffers: ofertas,
      freeShipping: envio,
      inStock: stock,
    }),
  ]);

  const chips: { key: string; label: string; value: string | null }[] = [];
  if (q) chips.push({ key: "q", label: `“${q}”`, value: null });
  marcas.forEach((brand) =>
    chips.push({
      key: "marca",
      label: brand,
      value: marcas.filter((b) => b !== brand).join(",") || null,
    }),
  );
  if (min || max)
    chips.push({
      key: "min",
      label: `${min ? money(min) : "$0"} - ${max ? money(max) : "∞"}`,
      value: null,
    });
  if (ofertas) chips.push({ key: "ofertas", label: "Solo ofertas", value: null });
  if (envio) chips.push({ key: "envio", label: "Envío gratis", value: null });
  if (stock) chips.push({ key: "stock", label: "Disponible ya", value: null });

  const buildPageHref = (page: number) => {
    const next = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (typeof value === "string" && key !== "pagina") next.set(key, value);
    });
    next.set("pagina", String(page));
    return `/productos?${next.toString()}`;
  };

  // Solo las categorías raíz van en el panel: las hijas cuelgan de /categoria/[...path].
  const rootCategories = categories.map((c) => ({
    slug: c.slug,
    name: c.name,
    icon: c.icon,
    path: c.path,
    count: c.count,
  }));

  return (
    <div className="container-xl py-8">
      <nav className="mb-4 flex items-center gap-1.5 text-xs text-ink-400">
        <Link href="/" className="hover:text-brand-700">
          Inicio
        </Link>
        <span>/</span>
        <span className="font-semibold text-ink-700">Catálogo</span>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 md:text-3xl">
          {q ? `Resultados para “${q}”` : "Todo el catálogo"}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Productos nuevos, con garantía oficial y envío a todo el país.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[17rem_1fr]">
        <Suspense fallback={<div className="hidden lg:block" />}>
          <FiltersPanel
            categories={rootCategories}
            brands={brands}
            current={{ marcas, min, max, ofertas, envio, stock }}
          />
        </Suspense>

        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-500">
              <strong className="text-ink-900">{result.total}</strong> producto{result.total === 1 ? "" : "s"}
              {result.pages > 1 ? ` · página ${result.page} de ${result.pages}` : ""}
            </p>
            <Suspense fallback={null}>
              <SortSelect value={orden} />
            </Suspense>
          </div>

          <Suspense fallback={null}>
            <ActiveFilters chips={chips} />
          </Suspense>

          {result.items.length === 0 ? (
            <div className="card-surface flex flex-col items-center gap-3 px-6 py-16 text-center">
              <span className="text-5xl">🔍</span>
              <h2 className="text-lg font-bold text-ink-900">No encontramos productos con esos filtros</h2>
              <p className="max-w-md text-sm text-ink-500">
                Probá quitando algún filtro o escribinos por WhatsApp: conseguimos más del 90% de los productos del
                mercado aunque no estén publicados.
              </p>
              <div className="mt-2 flex gap-3">
                <Link href="/productos" className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white">
                  Ver todo el catálogo
                </Link>
                <a
                  href="https://wa.me/5493516777774"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-ink-200 px-5 py-2.5 text-sm font-bold text-ink-700"
                >
                  Pedir cotización
                </a>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4">
              {result.items.map((product) => (
                <ProductCard key={product.slug} product={toView(product)} />
              ))}
            </div>
          )}

          {result.pages > 1 ? (
            <nav className="mt-8 flex items-center justify-center gap-2">
              {result.page > 1 ? (
                <Link
                  href={buildPageHref(result.page - 1)}
                  className="rounded-lg border border-ink-200 bg-white px-3.5 py-2 text-sm font-semibold text-ink-700 hover:border-brand-300"
                >
                  ← Anterior
                </Link>
              ) : null}
              {Array.from({ length: result.pages }, (_, i) => i + 1).map((page) => (
                <Link
                  key={page}
                  href={buildPageHref(page)}
                  className={`min-w-10 rounded-lg px-3.5 py-2 text-center text-sm font-bold transition ${
                    page === result.page
                      ? "bg-brand-600 text-white"
                      : "border border-ink-200 bg-white text-ink-700 hover:border-brand-300"
                  }`}
                >
                  {page}
                </Link>
              ))}
              {result.page < result.pages ? (
                <Link
                  href={buildPageHref(result.page + 1)}
                  className="rounded-lg border border-ink-200 bg-white px-3.5 py-2 text-sm font-semibold text-ink-700 hover:border-brand-300"
                >
                  Siguiente →
                </Link>
              ) : null}
            </nav>
          ) : null}
        </section>
      </div>
    </div>
  );
}
