import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ActiveFilters, FiltersPanel, SortSelect } from "@/components/catalog-filters";
import { CategoryIcon } from "@/components/category-icon";
import { CategoryChips, EmptyResults, Pagination } from "@/components/catalog-ui";
import { ProductCard } from "@/components/product-card";
import { money } from "@/lib/format";
import { toView } from "@/lib/product-view";
import { getBrandFacets, getCategoryByPath, getCategoryTree, listProducts } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Params = Promise<{ path: string[] }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pick(params: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#8211;|&#8212;/gi, "-")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(Number(d)))
    .replace(/\s+/g, " ")
    .trim();
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { path } = await params;
  const data = await getCategoryByPath(path);
  if (!data) return { title: "Categoría no encontrada" };

  const { node, ancestors } = data;
  const trail = [...ancestors.map((a) => a.name), node.name].join(" · ");
  const description =
    stripTags(node.descriptionHtml).slice(0, 155) ||
    `${node.name} en Córdoba Digital. ${node.count} productos con stock real, garantía legal y envíos a todo el país.`;

  return {
    title: `${node.name} — ${node.count} productos`,
    description,
    alternates: { canonical: `/categoria/${node.path}` },
    openGraph: {
      title: `${node.name} | Córdoba Digital`,
      description,
      url: `/categoria/${node.path}`,
      images: node.imageUrl ? [{ url: node.imageUrl, alt: node.name }] : undefined,
    },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ path }, query] = await Promise.all([params, searchParams]);
  const data = await getCategoryByPath(path);
  if (!data) notFound();

  const { node, ancestors, children, breadcrumb } = data;
  const marcasParam = pick(query, "marca");
  const marcas = marcasParam ? marcasParam.split(",").filter(Boolean) : [];
  const min = pick(query, "min") ? Number(pick(query, "min")) : undefined;
  const max = pick(query, "max") ? Number(pick(query, "max")) : undefined;
  const orden = pick(query, "orden") ?? "relevancia";
  const pagina = Number(pick(query, "pagina") ?? "1");
  const ofertas = pick(query, "ofertas") === "1";
  const stock = pick(query, "stock") === "1";

  const PER_PAGE = 24;
  const [brands, result, tree] = await Promise.all([
    getBrandFacets(node.id),
    listProducts({
      categoryId: node.id,
      brands: marcas,
      min,
      max,
      sort: orden,
      page: pagina,
      perPage: PER_PAGE,
      onlyOffers: ofertas,
      inStock: stock,
    }),
    getCategoryTree(),
  ]);

  const buildHref = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (typeof value === "string" && value) next.set(key, value);
    });
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null) next.delete(key);
      else next.set(key, value);
    });
    next.delete("pagina");
    return `/categoria/${node.path}?${next.toString()}`;
  };

  const pageHref = (page: number) => buildHref({ pagina: String(page) });

  const chips: { key: string; label: string; value: string | null; href: string }[] = [];
  marcas.forEach((brand) =>
    chips.push({
      key: `marca-${brand}`,
      label: brand,
      value: marcas.filter((b) => b !== brand).join(",") || null,
      href: buildHref({ marca: marcas.filter((b) => b !== brand).join(",") || null }),
    }),
  );
  if (min || max)
    chips.push({
      key: "precio",
      label: `${min ? money(min) : "$0"} - ${max ? money(max) : "∞"}`,
      value: null,
      href: buildHref({ min: null, max: null }),
    });
  if (ofertas) chips.push({ key: "ofertas", label: "Solo ofertas", value: null, href: buildHref({ ofertas: null }) });
  if (stock) chips.push({ key: "stock", label: "Disponible ya", value: null, href: buildHref({ stock: null }) });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: "/" },
      ...breadcrumb.map((crumb, i) => ({
        "@type": "ListItem",
        position: i + 2,
        name: crumb.name,
        item: `/categoria/${crumb.path}`,
      })),
    ],
  };

  return (
    <div className="container-xl py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
        <Link href="/" className="hover:text-brand-700">
          Inicio
        </Link>
        {breadcrumb.map((crumb, i) => (
          <span key={crumb.path} className="flex items-center gap-1.5">
            <span>/</span>
            {i === breadcrumb.length - 1 ? (
              <span className="font-semibold text-ink-700">{crumb.name}</span>
            ) : (
              <Link href={`/categoria/${crumb.path}`} className="hover:text-brand-700">
                {crumb.name}
              </Link>
            )}
          </span>
        ))}
      </nav>

      <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-ink-100 bg-surface p-5 md:flex-row md:items-center md:p-6">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
          <CategoryIcon name={node.name} className="h-8 w-8" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 md:text-3xl">{node.name}</h1>
          <p className="mt-1.5 max-w-3xl text-sm text-ink-600">
            {stripTags(node.descriptionHtml).slice(0, 240) ||
              node.tagline ||
              "Stock real, garantía legal y envíos a todo el país."}
          </p>
          {ancestors.length ? (
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
              <span>Ver también:</span>
              {ancestors.map((a) => (
                <Link
                  key={a.id}
                  href={`/categoria/${a.path}`}
                  className="rounded-full border border-ink-200 bg-surface px-2.5 py-1 font-semibold text-ink-600 hover:border-brand-300"
                >
                  {a.name}
                </Link>
              ))}
            </p>
          ) : null}
        </div>
        <p className="shrink-0 rounded-2xl bg-ink-50 px-4 py-2.5 text-center">
          <strong className="block text-xl font-black leading-none text-ink-900">{result.total.toLocaleString("es-AR")}</strong>
          <span className="text-[11px] font-medium uppercase tracking-wide text-ink-500">
            producto{result.total === 1 ? "" : "s"}
          </span>
        </p>
      </header>

      <CategoryChips items={tree.map((c) => ({ slug: c.slug, name: c.name, path: c.path }))} activePath={breadcrumb[0]?.path} />

      {children.length ? (
        <nav className="mb-6 flex flex-wrap gap-2" aria-label={`Subcategorías de ${node.name}`}>
          {children.map((child) => (
            <Link
              key={child.id}
              href={`/categoria/${child.path}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-surface px-3.5 py-1.5 text-sm font-semibold text-ink-700 transition hover:border-brand-300 hover:text-brand-700"
            >
              {child.name}
              <span className="text-[11px] font-normal text-ink-500">{child.count}</span>
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <Suspense fallback={<div className="hidden lg:block" />}>
          <FiltersPanel
            categories={[]}
            brands={brands}
            basePath={`/categoria/${node.path}`}
            current={{ marcas, min, max, ofertas, stock }}
          />
        </Suspense>

        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-500">
              {node.children.length ? "Incluye los productos de las subcategorías" : "Todos los productos de la categoría"}
            </p>
            <Suspense fallback={null}>
              <SortSelect value={orden} basePath={`/categoria/${node.path}`} />
            </Suspense>
          </div>

          {chips.length ? (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {chips.map((chip) => (
                <Link
                  key={chip.key}
                  href={chip.href}
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
                >
                  {chip.label}
                  <span aria-hidden className="text-brand-600">×</span>
                </Link>
              ))}
              <Link href={`/categoria/${node.path}`} className="text-xs font-semibold text-ink-400 hover:text-ink-700">
                Limpiar todo
              </Link>
            </div>
          ) : null}

          {result.items.length === 0 ? (
            <EmptyResults resetHref={`/categoria/${node.path}`} resetLabel="Ver toda la categoría" />
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4">
              {result.items.map((product) => (
                <ProductCard key={product.slug} product={toView(product)} />
              ))}
            </div>
          )}

          <Pagination page={result.page} pages={result.pages} hrefFor={pageHref} />
        </section>
      </div>
    </div>
  );
}
