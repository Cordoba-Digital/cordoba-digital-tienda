import Link from "next/link";

import { ProductImg } from "@/components/product-img";
import { money } from "@/lib/format";
import type { ProductView } from "@/lib/product-view";

export function HomeHero({
  productCount,
  ratingValue,
  reviewCount,
  featured,
}: {
  productCount: number;
  ratingValue: string | null;
  reviewCount: number | null;
  featured: ProductView | null;
}) {
  const stats = [
    { k: new Intl.NumberFormat("es-AR").format(productCount), v: "productos" },
    { k: "6 meses", v: "de garantía legal" },
    { k: "Todo el país", v: "de envíos" },
    ...(ratingValue && reviewCount ? [{ k: `${ratingValue}★`, v: "en Google" }] : []),
  ];

  return (
    <section className="mesh-dark relative overflow-hidden">
      <div className="container-xl relative grid items-center gap-8 py-9 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:py-12">
        <div className="animate-rise">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neon-400" />
            Local en 27 de Abril 180 · Envíos a todo el país
          </span>
          <h1 className="mt-3.5 text-balance-pretty text-[1.75rem] font-black leading-[1.08] tracking-tight text-white sm:text-4xl lg:text-[2.6rem]">
            Tecnología que llega
            <span className="bg-gradient-to-r from-neon-400 to-brand-300 bg-clip-text text-transparent">
              {" "}
              rápido, segura y con garantía
            </span>
          </h1>
          <p className="mt-3.5 max-w-xl text-[15px] leading-relaxed text-ink-200">
            Celulares, notebooks, cámaras, drones y gaming con stock real. Comprá online en 2 minutos, pagá como
            quieras y seguí tu pedido paso a paso.
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Link
              href="/productos"
              className="rounded-xl bg-gradient-to-r from-brand-500 to-neon-500 px-5 py-3 text-sm font-extrabold text-white shadow-[0_18px_40px_-16px_rgba(194,65,12,0.55)] transition hover:opacity-95"
            >
              Ver catálogo completo
            </Link>
            <Link
              href="/productos?ofertas=1"
              className="rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/10"
            >
              Ofertas de la semana
            </Link>
          </div>
          <dl className={`mt-6 grid max-w-xl gap-2.5 ${stats.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
            {stats.map((stat) => (
              <div key={stat.v} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 backdrop-blur">
                <dt className="text-base font-black leading-none text-white">{stat.k}</dt>
                <dd className="mt-1 text-[10px] font-medium uppercase tracking-wide text-ink-300">{stat.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl">
            <div className="aspect-[4/3] lg:aspect-[5/4]">
              {featured?.image ? (
                <ProductImg
                  src={featured.image}
                  srcSet={featured.imageSrcSets[0]}
                  alt={featured.name}
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  width={800}
                  height={640}
                  priority
                  className="h-full w-full object-contain p-8"
                />
              ) : (
                <div className="grid h-full place-items-center px-6 text-center text-sm text-ink-300">
                  Actualizando el catálogo con los productos de Córdoba Digital…
                </div>
              )}
            </div>
          </div>

          {featured ? (
            <Link
              href={`/producto/${featured.slug}`}
              className="absolute -bottom-5 left-2 hidden w-[18rem] animate-float-slow rounded-2xl border border-ink-100 bg-surface p-3 shadow-2xl sm:block"
            >
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-ink-50">
                  <ProductImg
                    src={featured.image}
                    srcSet={featured.imageSrcSets[0]}
                    alt=""
                    sizes="56px"
                    width={56}
                    height={56}
                    className="h-full w-full object-contain p-1"
                  />
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-1 text-xs font-bold text-ink-800">{featured.name}</p>
                  <p className="text-sm font-black text-ink-900">{money(featured.price)}</p>
                  <p className="text-[11px] font-semibold text-emerald-600">6 cuotas sin interés</p>
                </div>
              </div>
            </Link>
          ) : null}

          <div className="absolute -right-2 top-6 hidden animate-float-slow rounded-2xl border border-white/15 bg-deep/80 px-4 py-3 text-white backdrop-blur md:block">
            <p className="text-[11px] uppercase tracking-wide text-ink-300">Envío a todo el país</p>
            <p className="text-xl font-black text-neon-400">Andreani</p>
          </div>
        </div>
      </div>
    </section>
  );
}
