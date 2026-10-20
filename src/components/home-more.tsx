import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ProductRow } from "@/components/product-card";
import { ProductImg } from "@/components/product-img";
import type { CategoryTile } from "@/components/home-tiles";
import { SectionHeading } from "@/components/ui";

/**
 * Bloques que alargan la home al estilo de Mercado Libre: más filas de
 * productos por categoría, banners que cortan entre filas y la grilla de
 * categorías con foto del final. Todo sale del catálogo real; si no hay datos
 * suficientes, el bloque no se dibuja.
 */

export type CategoryRowData = CategoryTile;

/*
 * La bajada de las categorías (`tagline`) no se usa: en las migradas de
 * WooCommerce es el texto de SEO, largo y en mayúsculas.
 */

/**
 * Filas "Más para ver en…": una por categoría, cada una en su panel blanco
 * como las de Mercado Libre, para que dos filas seguidas no se fundan.
 */
export function HomeCategoryRows({ rows, label }: { rows: CategoryRowData[]; label: string }) {
  if (!rows.length) return null;
  return (
    <div aria-label={label} className="container-xl space-y-3 py-4 sm:space-y-5 sm:py-6">
      {rows.map((row) => (
        <section key={row.path} className="rounded-2xl bg-surface px-3 py-4 ring-1 ring-black/5 sm:rounded-[28px] sm:px-6 sm:py-7">
          <SectionHeading
            eyebrow="Más para ver"
            title={`Más en ${row.name}`}
            action={{ href: `/categoria/${row.path}`, label: `Ver los ${row.count.toLocaleString("es-AR")}` }}
          />
          <ProductRow products={row.products} label={row.name} />
        </section>
      ))}
    </div>
  );
}

/**
 * Dos banners anchos lado a lado, como los de marca de Mercado Libre pero con
 * categorías propias: uno oscuro y uno claro, con fotos de sus productos sobre
 * una placa blanca (las fotos vienen con fondo blanco).
 */
export function HomeBanners({ banners }: { banners: CategoryRowData[] }) {
  const items = banners.filter((b) => b.products.some((p) => p.image)).slice(0, 2);
  if (items.length < 2) return null;
  return (
    <section aria-label="Categorías para descubrir" className="container-xl py-4 sm:py-6">
      <ul className="grid gap-2.5 sm:gap-4 md:grid-cols-2">
        {items.map((banner, index) => {
          const dark = index === 0;
          const photos = banner.products.filter((p) => p.image).slice(0, 2);
          return (
            <li key={banner.path}>
              <Link
                href={`/categoria/${banner.path}`}
                className={`group flex h-36 items-stretch overflow-hidden rounded-2xl ring-1 transition hover:-translate-y-0.5 hover:shadow-lg sm:h-48 ${
                  dark ? "bg-ink-900 text-white ring-black/10" : "mesh-warm text-ink-900 ring-brand-100"
                }`}
              >
                <div className="flex w-[55%] flex-col justify-between p-4 sm:p-6">
                  <div>
                    <p className={`text-[10px] font-bold uppercase tracking-[0.18em] sm:text-[11px] ${dark ? "text-brand-300" : "text-brand-700"}`}>
                      {banner.count.toLocaleString("es-AR")} productos
                    </p>
                    <h3 className="mt-1 text-lg font-extrabold leading-tight tracking-tight sm:text-2xl">{banner.name}</h3>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-[13px] font-bold sm:text-sm ${dark ? "text-white" : "text-brand-700"}`}>
                    Ver productos<span className="sr-only"> de {banner.name}</span>
                    <ArrowRight size={14} className="transition group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </div>
                <div className="flex flex-1 items-center justify-center gap-2 p-3 sm:p-4">
                  {photos.map((photo, i) => (
                    <span
                      key={photo.slug}
                      className={`grid place-items-center rounded-xl bg-white p-2 shadow-sm ${i === 0 ? "h-full max-h-28 w-full max-w-28 sm:max-h-36 sm:max-w-36" : "hidden h-2/3 w-2/3 max-w-24 sm:grid"}`}
                    >
                      <ProductImg
                        src={photo.image}
                        srcSet={photo.imageSrcSets[0]}
                        alt={i === 0 ? photo.name : ""}
                        sizes="(max-width: 768px) 30vw, 12vw"
                        className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.04]"
                      />
                    </span>
                  ))}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Grilla "Todas las categorías" con una foto de cada una, como la del final
 * de Mercado Libre: para quien llegó al fondo sin encontrar lo que buscaba.
 */
export function HomeCategoryGrid({ tiles }: { tiles: CategoryTile[] }) {
  if (tiles.length < 4) return null;
  return (
    <section className="container-xl py-4 sm:py-6">
      <div className="rounded-2xl bg-surface px-3 py-4 ring-1 ring-black/5 sm:rounded-[28px] sm:px-6 sm:py-7">
        <SectionHeading eyebrow="Explorá" title="Todas las categorías" action={{ href: "/productos", label: "Ver catálogo" }} />
        <ul className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-4">
          {tiles.map((tile) => {
            const [photo] = tile.products;
            return (
              <li key={tile.path}>
                <Link
                  href={`/categoria/${tile.path}`}
                  className="group flex h-full items-center gap-2.5 overflow-hidden rounded-xl ring-1 ring-ink-100 transition hover:shadow-md hover:ring-brand-200 sm:gap-3"
                >
                  <span className="grid h-16 w-14 shrink-0 place-items-center bg-white p-1.5 sm:h-20 sm:w-20 sm:p-2">
                    <ProductImg
                      src={photo.image}
                      srcSet={photo.imageSrcSets[0]}
                      alt=""
                      sizes="80px"
                      className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.06]"
                    />
                  </span>
                  <span className="min-w-0 py-2 pr-2">
                    <span className="line-clamp-2 block text-[13px] font-bold leading-tight text-ink-900 sm:text-[15px]">{tile.name}</span>
                    <span className="mt-0.5 block text-[11px] text-ink-500 sm:text-xs">{tile.count.toLocaleString("es-AR")} productos</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
