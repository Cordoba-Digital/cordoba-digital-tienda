import type { Metadata } from "next";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import {
  ArrowRight,
  BadgePercent,
  Clock,
  ExternalLink,
  LayoutGrid,
  MapPin,
  Phone,
  Store,
  Trophy,
  Truck,
  Wallet,
} from "lucide-react";

import { CategoryRow } from "@/components/category-row";
import { Icon } from "@/components/category-icon";
import { FaqAccordion } from "@/components/faq-accordion";
import { HomeHero } from "@/components/home-hero";
import { HomeCategoryTabs, HomeExplore, HomeRecentlyViewed } from "@/components/home-sections";
import { NewsletterForm } from "@/components/newsletter-form";
import { ProductRow } from "@/components/product-card";
import { SectionHeading } from "@/components/ui";
import { discountPercent } from "@/lib/format";
import { getGoogleReviews } from "@/lib/google-reviews";
import { visibleHomeBlocks, type HomeBlockId } from "@/lib/home-layout";
import type { HeroSlideId } from "@/lib/hero-picks";
import { getHeroPicks } from "@/lib/hero-picks-server";
import { getHomeLayout } from "@/lib/home-layout-server";
import { toView } from "@/lib/product-view";
import { renderPerRequestIfNoDatabase } from "@/lib/store-cache";
import { jsonLdString, storeJsonLd } from "@/lib/structured-data";
import {
  getBestSellers,
  getCategoryShowcase,
  getCategoryTree,
  getDealProducts,
  getFeaturedProducts,
  getGuides,
  getProductCount,
  listProducts,
} from "@/lib/queries";

/** En la caché del CDN, regenerada cada 5 minutos o al cambiar algo desde el panel. */
export const revalidate = 300;

export const metadata: Metadata = {
  // La home no tenía canonical y era la única que se indexaba sin señalar
  // dónde está la versión buena. Con esto toda página indexable declara la suya.
  alternates: { canonical: "/" },
};

/*
 * Datos del local, tomados del sitio original. Se declaran una sola vez acá
 * porque la sección del local y el pie los repiten.
 */
const DIRECCION = "27 de Abril 180, Córdoba Capital";
const HORARIOS = "Lun a Vie 14:00 a 18:30 · Sáb 12:00 a 14:30";
const TELEFONO = "+54 351 677-7774";
const MAPS = "https://maps.google.com/?q=27+de+Abril+180+Cordoba+Argentina";
const WHATSAPP = "https://wa.me/5493516777774";

const TRUST = [
  { icon: "truck", title: "Envíos a todo el país", text: "Andreani a domicilio o a sucursal, con seguimiento." },
  { icon: "lock", title: "Pagos claros", text: "Transferencia bancaria y efectivo/seña en el local." },
  { icon: "shield", title: "Compra garantizada", text: "6 meses de garantía legal y postventa en Córdoba." },
  { icon: "headphones", title: "Postventa real", text: "WhatsApp, mail y el local. Nada de call center." },
];

const FAQ = [
  {
    q: "¿Cuánto tarda el envío?",
    a: "Despachamos a todo el país con Andreani. Podés elegir entrega a domicilio o retiro en la sucursal más cercana.",
  },
  {
    q: "¿Los productos son nuevos y con garantía?",
    a: "Sí. Todos los productos son nuevos y cuentan con 6 meses de garantía legal a partir de la entrega (Ley 24.240), con servicio técnico propio en el local.",
  },
  {
    q: "¿Qué medios de pago aceptan?",
    a: "Transferencia bancaria.",
  },
  {
    q: "¿Puedo retirar en el local?",
    a: "Sí. Comprá online y retirá en 27 de Abril 180, Córdoba Capital, dentro del horario de atención.",
  },
  {
    q: "¿Puedo ver el equipo antes de comprarlo?",
    a: "En el local probamos el equipo con vos antes de que te lo lleves. Si no podés venir, contanos por WhatsApp qué modelo te interesa.",
  },
  {
    q: "¿Hacen cambio si algo no funciona?",
    a: "Sí. La garantía se gestiona con nuestro servicio técnico en Córdoba y el cambio o la reparación se resuelven por el mismo canal.",
  },
];

export default async function HomePage() {
  await renderPerRequestIfNoDatabase();
  const layout = await getHomeLayout();
  const visible = visibleHomeBlocks(layout);
  // Los bloques nuevos piden datos aparte: si están ocultos, no se consultan.
  const [featured, deals, bestSellers, categories, googleReviews, productCount, guides, showcase, explore] = await Promise.all([
    getFeaturedProducts(24),
    getDealProducts(8),
    getBestSellers(8),
    getCategoryTree(),
    getGoogleReviews(),
    getProductCount(),
    getGuides(),
    visible.includes("por-categoria") ? getCategoryShowcase() : Promise.resolve([]),
    visible.includes("explorar") ? listProducts({ inStock: true, perPage: 10 }) : Promise.resolve(null),
  ]);

  const ratingValue = googleReviews.rating?.toFixed(1) ?? null;
  const reviewCount = googleReviews.count;
  // Hero de 5 slides: principal, oferta, más vendido, envío y pago. Cada uno
  // elige su producto solo (Panel → Automatizaciones, ver `lib/hero-picks.ts`);
  // con la automatización apagada se usa el mapeo de siempre, que va de respaldo.
  const hero = await getHeroPicks({
    inicio: featured[0],
    ofertas: deals[0],
    vendidos: bestSellers[0],
    envios: featured[1],
    pagos: featured[2],
  }).catch((error) => {
    console.warn("[portada] no se pudo elegir el carrusel, uso el de siempre:", error instanceof Error ? error.message : error);
    return null;
  });
  const heroView = (id: HeroSlideId, before: Parameters<typeof toView>[0] | undefined) => {
    const product = hero ? hero[id]?.product : before;
    return product ? toView(product) : null;
  };
  const heroMain = heroView("inicio", featured[0]);
  const heroDeal = heroView("ofertas", deals[0]);
  const heroBest = heroView("vendidos", bestSellers[0]);
  const heroShipping = heroView("envios", featured[1]);
  const heroPayment = heroView("pagos", featured[2]);
  const heroMaxOff = Math.max(0, ...deals.map((d) => discountPercent(d.price, d.compareAtPrice)));
  // "Destacados" y "Más vendidos" caían al mismo fallback (lo más nuevo con
  // stock) y mostraban los mismos productos. Acá se excluyen los ya mostrados
  // arriba; si no quedan suficientes distintos, la sección no se muestra.
  const bestSlugs = new Set(bestSellers.map((p) => p.slug));
  const dealSlugs = new Set(deals.map((p) => p.slug));
  const featuredPicks = featured.filter((p) => !bestSlugs.has(p.slug) && !dealSlugs.has(p.slug)).slice(0, 8);
  // Los accesos apuntan al bloque del local solo si está en la home.
  const pickupHref = visible.includes("local") ? "#local" : "/ayuda";

  /*
   * Cada bloque de la home, por id. El orden y cuáles se muestran salen de
   * Panel → Inicio (ver `lib/home-layout.ts`); acá solo se dibujan.
   */
  const blocks: Record<HomeBlockId, () => ReactNode> = {
    portada: () => (
      <>
          {/*
            Hero y cintillo comparten el mismo fondo crema de marca (`mesh-warm` vive
            acá y no en el carrusel): baja hasta el borde inferior del cintillo, con
            corte recto.
          */}
          <div className="mesh-warm">
            <HomeHero
              productCount={productCount}
              ratingValue={ratingValue}
              reviewCount={reviewCount}
              main={heroMain}
              deal={heroDeal}
              best={heroBest}
              shipping={heroShipping}
              payment={heroPayment}
              maxOff={heroMaxOff}
            />

            {/*
              Cintillo de confianza: una caja blanca que pisa el hero. El `z-10` la
              saca del orden normal para que la sombra caiga sobre el fondo del hero.
            */}
            {/* En el celular no va: la barra naranja de arriba ya rota estos
                mismos mensajes, y acá repetía lo mismo en la primera pantalla. */}
            <section className="relative z-10 -mt-8 hidden sm:block">
              <div className="container-xl">
                <div className="grid grid-cols-4 overflow-hidden rounded-2xl bg-surface shadow-[0_20px_50px_-30px_rgba(20,22,28,0.45)] ring-1 ring-black/5 sm:grid-cols-2 lg:grid-cols-4">
                  {TRUST.map((t, i) => (
                    <div
                      key={t.title}
                      className={`flex flex-col items-center gap-1 border-ink-100 px-1 py-2.5 text-center sm:flex-row sm:items-start sm:gap-3 sm:p-5 sm:text-left ${i > 0 ? "max-sm:border-l" : ""} ${i % 2 ? "sm:border-l" : ""} ${i > 1 ? "sm:border-t lg:border-t-0" : ""} ${i === 2 ? "lg:border-l" : ""}`}
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 sm:h-10 sm:w-10 sm:rounded-xl">
                        <Icon name={t.icon} className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
                      </span>
                      <div>
                        <p className="text-balance text-[11px] font-bold leading-tight text-ink-900 sm:text-sm">{t.title}</p>
                        <p className="mt-0.5 hidden text-xs leading-relaxed text-ink-500 sm:block">{t.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
      </>
    ),
    vistos: () => <HomeRecentlyViewed />,
    accesos: () => (
      <>
        {/*
          Accesos rápidos (el "dynamic access" de Mercado Libre): atajos a lo que
          más se busca, sin pasar por el menú.
        */}
        <nav aria-label="Accesos rápidos" className="container-xl pt-4 sm:pt-10">
          {/* En el celular son íconos redondos con su nombre abajo, como los de
              Mercado Libre: entran los cinco en una fila sin deslizar. */}
          <ul className="no-scrollbar -mx-4 flex snap-x justify-between gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-2.5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-5">
            {[
              { href: "/productos?ofertas=1", icon: BadgePercent, title: "Ofertas", text: heroMaxOff > 0 ? `Hasta ${heroMaxOff}% OFF` : "Precios de la semana" },
              { href: "/productos?orden=vendidos", icon: Trophy, title: "Más vendidos", text: "El ranking del depósito" },
              { href: "/productos", icon: LayoutGrid, title: "Todo el catálogo", text: `${productCount} productos` },
              { href: pickupHref, icon: Store, title: "Retiro en el local", text: "27 de Abril 180" },
              { href: "/ayuda", icon: Truck, title: "Envíos y pagos", text: "Andreani a todo el país" },
            ].map((a) => (
              <li key={a.title} className="w-[66px] shrink-0 snap-start sm:w-auto">
                <Link
                  href={a.href}
                  className="flex h-full flex-col items-center gap-1.5 text-center transition sm:flex-row sm:gap-3 sm:rounded-2xl sm:bg-surface sm:p-3.5 sm:text-left sm:ring-1 sm:ring-black/5 sm:hover:-translate-y-0.5 sm:hover:shadow-lg"
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-surface text-brand-700 shadow-sm ring-1 ring-black/5 sm:h-10 sm:w-10 sm:rounded-xl sm:bg-brand-50 sm:shadow-none sm:ring-0">
                    <a.icon size={20} aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] font-semibold leading-tight text-ink-700 sm:text-sm sm:font-bold sm:text-ink-900">{a.title}</span>
                    <span className="hidden text-xs leading-snug text-ink-500 sm:block">{a.text}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </>
    ),
    categorias: () => (
      <>
          {/*
            Fila desplazable de categorías: 21 raíces reales con su icono y su conteo
            de la base. La foto, el dron y el CCTV van por separado, para que no
            confundas una cosa con otra.
          */}
          <section id="categorias" className="container-xl py-5 sm:py-14">
            <SectionHeading
              eyebrow="Explorá"
              title="Categorías"
              action={{ href: "/productos", label: "Ver todo" }}
            />
            {/*
              La fila vive en su propio componente porque necesita estado para la
              barra de avance y para apagar las flechas en los extremos.
            */}
            <CategoryRow
              items={categories.map((c) => ({ name: c.name, href: `/categoria/${c.path}`, count: c.count }))}
              label="las categorías"
            />
          </section>
      </>
    ),
    ofertas: () => (
      <>
          {/* Ofertas: panel crema de marca con las mayores rebajas reales. */}
          <section id="ofertas" className="container-xl">
            <div className="mesh-warm -mx-1 rounded-2xl px-3 py-4 ring-1 ring-brand-100 sm:mx-0 sm:rounded-3xl sm:px-6 sm:py-8">
              <div className="flex items-end justify-between gap-3 sm:flex-wrap sm:gap-4">
                <div className="min-w-0">
                  <p className="hidden items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-700 sm:inline-flex">
                    <BadgePercent size={13} aria-hidden /> Ofertas
                  </p>
                  <h2 className="text-lg font-extrabold leading-tight tracking-tight text-ink-900 sm:mt-1 sm:text-3xl">
                    Los descuentos más grandes de la tienda
                  </h2>
                  {/* Sin cuenta regresiva: los precios no cambian a la medianoche,
                      y anunciar un vencimiento que no existe es publicidad engañosa. */}
                  <p className="mt-1 hidden max-w-xl text-sm text-ink-500 sm:block">
                    Productos con precio rebajado y stock en el depósito, de mayor a menor descuento.
                  </p>
                </div>
                <Link href="/productos?ofertas=1" className="inline-flex shrink-0 items-center gap-1 text-[13px] font-bold text-brand-700 hover:text-brand-800 sm:gap-1.5 sm:text-sm">
                  <span className="sm:hidden">Ver todas</span>
                  <span className="hidden sm:inline">Ver todas las ofertas</span> <ArrowRight size={14} aria-hidden />
                </Link>
              </div>
              <div className="mt-3 sm:mt-6">
                <ProductRow products={deals.map(toView)} label="las ofertas" />
              </div>
            </div>
          </section>
      </>
    ),
    "pagos-retiro": () => (
      <>
          <section className="container-xl grid gap-3 py-5 sm:gap-4 sm:py-8 md:grid-cols-2">
            <article className="rounded-2xl bg-surface p-4 ring-1 ring-black/5 sm:rounded-3xl sm:p-6">
              <div className="mb-4 hidden h-1 w-14 rounded-full bg-emerald-500 sm:block" />
              <h3 className="flex items-center gap-2 text-base font-extrabold tracking-tight text-ink-900 sm:block sm:text-xl">
                <Wallet size={22} className="shrink-0 text-emerald-700 sm:mb-3" aria-hidden />Transferencia o efectivo en el local</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500 sm:mt-2 sm:text-sm">
                Te mostramos el CBU cuando confirmás el pedido, no antes. En el local también podés pagar en efectivo o seña.
                Nunca te pedimos una clave, un código ni un token por chat.
              </p>
              <Link href="/ayuda" className="mt-2 inline-block text-[13px] font-bold text-brand-700 hover:text-brand-800 sm:mt-4 sm:text-sm">
                Ver medios de pago
              </Link>
            </article>
            <article className="rounded-2xl bg-surface p-4 ring-1 ring-black/5 sm:rounded-3xl sm:p-6">
              <div className="mb-4 hidden h-1 w-14 rounded-full bg-brand-500 sm:block" />
              <h3 className="flex items-center gap-2 text-base font-extrabold tracking-tight text-ink-900 sm:block sm:text-xl">
                <Store size={22} className="shrink-0 text-brand-700 sm:mb-3" aria-hidden />Retiro en el local</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500 sm:mt-2 sm:text-sm">
                Comprá online y retirá en {DIRECCION}. {HORARIOS}. Probamos el equipo con vos antes de que te lo lleves.
              </p>
              <a href={WHATSAPP} className="mt-2 inline-block text-[13px] font-bold text-brand-700 hover:text-brand-800 sm:mt-4 sm:text-sm">
                Avisar que paso a retirar
              </a>
            </article>
          </section>
      </>
    ),
    "mas-vendidos": () => (
      <>
          <section className="container-xl py-5 sm:py-6">
            <SectionHeading
              eyebrow="Elegidos por los cordobeses"
              title="Los más vendidos"
              description="Lo que más sale de nuestro depósito esta semana, con stock confirmado."
              action={{ href: "/productos?orden=vendidos", label: "Ver ranking" }}
            />
            <ProductRow
              products={bestSellers.slice(0, 8).map(toView)}
              label="los más vendidos"
              badges={bestSellers.slice(0, 8).map((_, i) => (i < 3 ? `Top ${i + 1}` : undefined))}
            />
          </section>
      </>
    ),
    "por-categoria": () =>
      showcase.length ? (
        <HomeCategoryTabs
          tabs={showcase.map((tab) => ({ name: tab.name, path: tab.path, count: tab.count, products: tab.products.map(toView) }))}
        />
      ) : null,
    explorar: () =>
      explore ? <HomeExplore initial={explore.items.map(toView)} total={explore.total} hasMore={explore.pages > 1} /> : null,
    local: () => (
      <>
          <section id="local" className="container-xl grid gap-3 py-6 sm:gap-4 sm:py-12 lg:grid-cols-2">
            <div className="relative flex min-h-[340px] flex-col justify-end overflow-hidden rounded-2xl sm:min-h-[560px] sm:rounded-3xl bg-ink text-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/local-cordoba-1400.jpg"
                srcSet={["/images/local-cordoba-700.jpg 700w", "/images/local-cordoba-1400.jpg 1400w"].join(", ")}
                sizes="(max-width: 1024px) 100vw, 50vw"
                alt="Fachada del local de Córdoba Digital en 27 de Abril 180, Córdoba Capital"
                width={1400}
                height={882}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/5" />
              <div className="relative z-10 space-y-2 px-4 pb-4 pt-8 sm:space-y-3 sm:px-6 sm:pb-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/45">Local a la calle</p>
                <h3 className="text-2xl font-extrabold">Córdoba Digital</h3>
                <p className="flex items-start gap-2 text-sm text-white/80">
                  <MapPin size={16} className="mt-0.5 shrink-0 text-brand-300" aria-hidden />
                  {DIRECCION}
                </p>
                <p className="flex items-start gap-2 text-sm text-white/80">
                  <Clock size={16} className="mt-0.5 shrink-0 text-brand-300" aria-hidden />
                  {HORARIOS}
                </p>
                <p className="flex items-center gap-2 text-sm text-white/80">
                  <Phone size={16} className="text-brand-300" aria-hidden />
                  <a href="tel:+543516777774" className="hover:text-white">
                    {TELEFONO}
                  </a>
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <a
                    href={MAPS}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-surface px-4 py-2 text-sm font-bold text-ink-900"
                  >
                    Cómo llegar <ExternalLink size={14} aria-hidden />
                  </a>
                  <a
                    href={WHATSAPP}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-4 py-2 text-sm font-bold text-white"
                  >
                    Consultar por WhatsApp
                  </a>
                </div>
              </div>
            </div>
            <div className="flex flex-col justify-center rounded-2xl bg-surface p-4 ring-1 ring-black/5 sm:rounded-3xl sm:p-8">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-700">Online + local a la calle</p>
              <h2 className="mt-1 text-xl font-extrabold leading-[1.15] tracking-tight text-ink-900 sm:mt-2 sm:text-3xl sm:leading-[1.1]">
                Comprás por internet, pero hay gente real del otro lado
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-500 sm:mt-3 sm:text-sm">
                Combinamos la agilidad del e-commerce con la confianza de atender en el centro. Si algo falla, no discutís
                con un chatbot: venís al local o nos escribís por WhatsApp y lo resolvemos.
              </p>
              <ul className="mt-3 space-y-2 sm:mt-5 sm:space-y-3">
                {[
                  "Probamos el equipo con vos antes de que te lo lleves",
                  "Servicio técnico y gestión de garantía en Córdoba",
                  "Asesoramiento para elegir el modelo correcto",
                  "Emitimos factura o comprobante de compra",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[13px] font-medium text-ink-700 sm:text-sm">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2 sm:mt-6">
                <a
                  href={MAPS}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-ink-900 px-4 py-2.5 text-sm font-bold text-white"
                >
                  Cómo llegar
                </a>
                <a
                  href={WHATSAPP}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-bold text-ink-700 hover:bg-ink-50"
                >
                  Consultar por WhatsApp
                </a>
              </div>
            </div>
          </section>
      </>
    ),
    destacados: () => (
      <>
          {featuredPicks.length >= 4 ? (
            <section className="container-xl py-4">
              <SectionHeading
                eyebrow="Selección del equipo"
                title="Destacados de la semana"
                description="Lo que recomendaríamos si nos preguntás por rendimiento, precio y disponibilidad real."
                action={{ href: "/productos", label: "Ver catálogo" }}
              />
              <ProductRow products={featuredPicks.map(toView)} label="los destacados" />
            </section>
          ) : null}
      </>
    ),
    guias: () => (
      <>
          {guides.length > 0 ? (
            <section className="container-xl py-6 sm:py-12">
              <SectionHeading
                eyebrow="Antes de comprar"
                title="Guías cortas, sin relleno"
                action={{ href: "/ayuda", label: "Centro de ayuda" }}
              />
              <div className="grid gap-2 sm:gap-3 md:grid-cols-3">
                {guides.slice(0, 3).map((g) => (
                  <Link
                    key={g.slug}
                    href={`/${g.slug}`}
                    className="rounded-2xl bg-surface p-4 ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-lg sm:rounded-3xl sm:p-5"
                  >
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-700">Guía de compra</p>
                    <h3 className="mt-1 text-base font-extrabold tracking-tight text-ink-900 sm:mt-2 sm:text-lg">{g.title}</h3>
                    {/* Sin bajada: el `subtitle` de la guia es el titulo de SEO en
                        mayusculas y repetiria el titulo de la tarjeta. */}
                    <span className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-ink-900 sm:mt-4">
                      Leer <ArrowRight size={14} aria-hidden />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
      </>
    ),
    preguntas: () => (
      <>
          <section id="preguntas" className="container-xl grid gap-3 pb-10 pt-2 sm:gap-4 sm:pb-16 sm:pt-0 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-2xl bg-surface p-4 ring-1 ring-black/5 sm:rounded-3xl sm:p-7">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-700">Antes de comprar</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-tight text-ink-900 sm:text-2xl">Preguntas frecuentes</h2>
              <div className="mt-3">
                <FaqAccordion items={FAQ} variant="plano" />
              </div>
              <Link href="/ayuda" className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-brand-700">
                Centro de ayuda <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
            <div className="mesh-warm flex flex-col justify-between rounded-2xl p-4 ring-1 ring-brand-100 sm:rounded-3xl sm:p-7">
              <div>
                <p className="inline-flex rounded-lg bg-white/70 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-700">
                  Newsletter
                </p>
                <h3 className="mt-3 text-xl font-extrabold tracking-tight text-ink-900 sm:mt-4 sm:text-2xl">Novedades y ofertas de Córdoba Digital</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">Ingresos de depósito y ofertas fuertes. No un mail por día.</p>
              </div>
              <div className="mt-4 sm:mt-6">
                <NewsletterForm variant="light" />
              </div>
            </div>
          </section>
      </>
    ),
  };

  return (
    <>
      {/* El local (negocio local) con horarios, perfiles y la nota de Google:
          los datos salen de lib/structured-data.ts, igual que en el resto. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString(
            storeJsonLd(ratingValue && reviewCount ? { ratingValue, reviewCount } : undefined),
          ),
        }}
      />

      {visible.map((id) => (
        <Fragment key={id}>{blocks[id]()}</Fragment>
      ))}
    </>
  );
}
