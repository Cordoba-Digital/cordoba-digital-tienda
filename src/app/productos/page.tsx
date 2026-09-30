import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ActiveFilters, FiltersPanel, SortSelect } from "@/components/catalog-filters";
import { CategoryChips, EmptyResults, Pagination } from "@/components/catalog-ui";
import { ProductCard } from "@/components/product-card";
import { money } from "@/lib/format";
import { toView } from "@/lib/product-view";
import { getBrandFacets, getCategoryTree, listProducts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Catálogo de tecnología",
  // El 15% OFF con transferencia se sacó del sitio (no existe en el checkout
  // del original) pero se había quedado en esta descripción, que es lo que
  // Google muestra en los resultados. Solo van datos reales.
  description:
    "Celulares, notebooks, cámaras, drones, gaming y más con stock real y envío a todo el país por Andreani.",
  alternates: { canonical: "/productos" },
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
      <nav className="mb-4 flex items-center gap-1.5 text-xs text-ink-500">
        <Link href="/" className="hover:text-brand-700">
          Inicio
        </Link>
        <span>/</span>
        <span className="font-semibold text-ink-700">Catálogo</span>
      </nav>

      <header className="mb-5">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 md:text-3xl">
          {q ? `Resultados para “${q}”` : ofertas ? "Ofertas de la semana" : "Todo el catálogo"}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Productos nuevos, con garantía legal y envío a todo el país.
        </p>
      </header>

      <CategoryChips items={rootCategories} />

      {/* `minmax(0,1fr)` y no `1fr`: el valor por defecto de un ítem de grid es
          `min-width: auto`, o sea que la columna crece hasta el ancho de su
          contenido en vez de ceder. Con `1fr` la grilla de productos se
          desbordaba a ~5.900 px y cada tarjeta quedaba de 1.460 px de lado. */}
      <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <Suspense fallback={<div className="hidden lg:block" />}>
          <FiltersPanel
            categories={rootCategories}
            brands={brands}
            current={{ marcas, min, max, ofertas, stock }}
          />
        </Suspense>

        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 pb-3">
            <p className="text-sm text-ink-500">
              <strong className="text-ink-900">{result.total.toLocaleString("es-AR")}</strong> producto{result.total === 1 ? "" : "s"}
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
            <EmptyResults resetHref="/productos" resetLabel="Ver todo el catálogo" />
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4">
              {result.items.map((product) => (
                <ProductCard key={product.slug} product={toView(product)} />
              ))}
            </div>
          )}

          <Pagination page={result.page} pages={result.pages} hrefFor={buildPageHref} />
        </section>
      </div>
    </div>
  );
}
