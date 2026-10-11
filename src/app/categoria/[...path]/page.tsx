import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";

import { ActiveFilters, FiltersPanel, SortSelect } from "@/components/catalog-filters";
import { CategoryIcon } from "@/components/category-icon";
import { CategoryChips, EmptyResults, Pagination } from "@/components/catalog-ui";
import { ProductCard } from "@/components/product-card";
import { mergedCategoryRedirect } from "@/lib/category-merges";
import { money } from "@/lib/format";
import { toView } from "@/lib/product-view";
import { url as siteUrl } from "@/lib/site";
import { breadcrumbJsonLd, jsonLdString } from "@/lib/structured-data";
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

/**
 * Primer párrafo con sustancia de la descripción de la categoría, cortado en
 * una palabra. Antes se pasaba el HTML entero por `stripTags` y la meta
 * description arrancaba con el título de la guía pegado al párrafo
 * ("Guía completa para entender... Celulares en Argentina..."), que es lo que
 * Google mostraba en el resultado.
 */
function metaDescription(html: string, max = 155): string {
  for (const [, inner] of html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const texto = stripTags(inner);
    if (texto.length < 70) continue;
    if (texto.length <= max) return texto;
    const corte = texto.slice(0, max - 1);
    return `${corte.slice(0, corte.lastIndexOf(" ")).replace(/[\s,;:.\-–]+$/, "")}…`;
  }
  return "";
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}): Promise<Metadata> {
  const [{ path }, query] = await Promise.all([params, searchParams]);
  const data = await getCategoryByPath(path);
  if (!data) return { title: "Categoría no encontrada" };

  const { node, ancestors } = data;
  const trail = [...ancestors.map((a) => a.name), node.name].join(" · ");
  const description =
    metaDescription(node.descriptionHtml) ||
    `${node.name} en Córdoba Digital: ${node.count} productos con stock real, garantía y envíos a todo el país desde Córdoba.`;

  // Las páginas 2, 3... llevan su propio canonical: si apuntaran a la 1, Google
  // deja de rastrear los productos que solo aparecen ahí. Los filtros (marca,
  // precio, orden) sí se consolidan en la URL limpia de la categoría.
  const pagina = Number(pick(query, "pagina") ?? "1");
  const canonical = `/categoria/${node.path}${pagina > 1 ? `?pagina=${pagina}` : ""}`;

  return {
    title: `${node.name} — ${node.count} productos`,
    description,
    alternates: { canonical },
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
  if (!data) {
    // Categoría fusionada en otra (ver category-merges.ts): la URL vieja no se pierde.
    const target = mergedCategoryRedirect(path.join("/"));
    if (target) permanentRedirect(target);
    notFound();
  }

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

  const buildHref = (updates: Record<string, string | null>, keepPage = false) => {
    const next = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (typeof value === "string" && value) next.set(key, value);
    });
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null) next.delete(key);
      else next.set(key, value);
    });
    // Cambiar de filtros vuelve a la página 1 (la 3 de otros filtros no existe
    // acá); solo los links de paginación conservan `pagina`.
    if (!keepPage) next.delete("pagina");
    return `/categoria/${node.path}?${next.toString()}`;
  };

  const pageHref = (page: number) => buildHref({ pagina: String(page) }, true);

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

  const jsonLd = [
    breadcrumbJsonLd([
      { name: "Inicio", path: "/" },
      ...breadcrumb.map((crumb) => ({ name: crumb.name, path: `/categoria/${crumb.path}` })),
    ]),
    // Los productos de esta página, en orden: le dice a Google y a los
    // buscadores de IA qué hay en la categoría sin tener que leer las tarjetas.
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: node.name,
      numberOfItems: result.total,
      itemListElement: result.items.map((product, i) => ({
        "@type": "ListItem",
        position: (pagina - 1) * PER_PAGE + i + 1,
        url: siteUrl(`/producto/${product.slug}`),
        name: product.name,
      })),
    },
  ];

  return (
    <div className="container-xl py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />

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

      {node.descriptionHtml?.trim() ? (
        <section className="card-surface mt-8 p-6">
          <div
            className="prose-cd prose-soft"
            dangerouslySetInnerHTML={{ __html: node.descriptionHtml }}
          />
        </section>
      ) : null}
    </div>
  );
}
