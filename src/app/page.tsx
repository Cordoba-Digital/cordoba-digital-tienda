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
  Timer,
  Trophy,
  Truck,
  Wallet,
} from "lucide-react";

import { CategoryRow } from "@/components/category-row";
import { Icon } from "@/components/category-icon";
import { Countdown } from "@/components/countdown";
import { FaqAccordion } from "@/components/faq-accordion";
import { HomeHero } from "@/components/home-hero";
import { NewsletterForm } from "@/components/newsletter-form";
import { ProductRow } from "@/components/product-card";
import { SectionHeading } from "@/components/ui";
import { discountPercent } from "@/lib/format";
import { getGoogleReviews } from "@/lib/google-reviews";
import { visibleHomeBlocks, type HomeBlockId } from "@/lib/home-layout";
import { getHomeLayout } from "@/lib/home-layout-server";
import { toView } from "@/lib/product-view";
import { renderPerRequestIfNoDatabase } from "@/lib/store-cache";
import { jsonLdString, storeJsonLd } from "@/lib/structured-data";
import {
  getBestSellers,
  getCategoryTree,
  getDealProducts,
  getFeaturedProducts,
  getGuides,
  getProductCount,
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
  const [featured, deals, bestSellers, categories, googleReviews, productCount, guides, layout] = await Promise.all([
    getFeaturedProducts(24),
    getDealProducts(8),
    getBestSellers(8),
    getCategoryTree(),
    getGoogleReviews(),
    getProductCount(),
    getGuides(),
    getHomeLayout(),
  ]);

  const ratingValue = googleReviews.rating?.toFixed(1) ?? null;
  const reviewCount = googleReviews.count;
  // Hero de 5 slides: principal, oferta, más vendido, envío y pago. Mismo
  // mapeo que la propuesta original, sobre los queries del deploy.
  const heroMain = featured[0] ? toView(featured[0]) : null;
  const heroDeal = deals[0] ? toView(deals[0]) : null;
  const heroBest = bestSellers[0] ? toView(bestSellers[0]) : null;
  const heroShipping = featured[1] ? toView(featured[1]) : null;
  const heroPayment = featured[2] ? toView(featured[2]) : null;
  const heroMaxOff = Math.max(0, ...deals.map((d) => discountPercent(d.price, d.compareAtPrice)));
  // "Destacados" y "Más vendidos" caían al mismo fallback (lo más nuevo con
  // stock) y mostraban los mismos productos. Acá se excluyen los ya mostrados
  // arriba; si no quedan suficientes distintos, la sección no se muestra.
  const bestSlugs = new Set(bestSellers.map((p) => p.slug));
  const dealSlugs = new Set(deals.map((p) => p.slug));
  const featuredPicks = featured.filter((p) => !bestSlugs.has(p.slug) && !dealSlugs.has(p.slug)).slice(0, 8);
  const visible = visibleHomeBlocks(layout);
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
            Hero y cintillo comparten el mismo fondo oscuro (`mesh-dark` vive acá y
            no en el carrusel): el negro baja hasta el borde inferior del cintillo,
            con corte recto, en vez de partirlo mitad oscuro y mitad crema.
          */}
          <div className="mesh-dark">
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
              saca del orden normal para que la sombra caiga sobre el fondo oscuro.
            */}
            <section className="relative z-10 -mt-6 sm:-mt-8">
              <div className="container-xl">
                <div className="grid overflow-hidden rounded-2xl bg-surface shadow-[0_20px_50px_-30px_rgba(20,22,28,0.45)] ring-1 ring-black/5 sm:grid-cols-2 lg:grid-cols-4">
                  {TRUST.map((t, i) => (
                    <div
                      key={t.title}
                      className={`flex gap-3 p-4 sm:p-5 ${i > 0 ? "border-t border-ink-100 sm:border-t-0 sm:border-l sm:border-ink-100" : ""}`}
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
                        <Icon name={t.icon} className="h-[18px] w-[18px]" />
                      </span>
                      <div>
                        <p className="text-sm font-bold text-ink-900">{t.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{t.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
      </>
    ),
    accesos: () => (
      <>
        {/*
          Accesos rápidos (el "dynamic access" de Mercado Libre): atajos a lo que
          más se busca, sin pasar por el menú.
        */}
        <nav aria-label="Accesos rápidos" className="container-xl pt-10">
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { href: "/productos?ofertas=1", icon: BadgePercent, title: "Ofertas", text: heroMaxOff > 0 ? `Hasta ${heroMaxOff}% OFF` : "Precios de la semana" },
              { href: "/productos?orden=vendidos", icon: Trophy, title: "Más vendidos", text: "El ranking del depósito" },
              { href: "/productos", icon: LayoutGrid, title: "Todo el catálogo", text: `${productCount} productos` },
              { href: pickupHref, icon: Store, title: "Retiro en el local", text: "27 de Abril 180" },
              { href: "/ayuda", icon: Truck, title: "Envíos y pagos", text: "Andreani a todo el país" },
            ].map((a) => (
              <li key={a.title}>
                <Link
                  href={a.href}
                  className="flex h-full items-center gap-3 rounded-2xl bg-surface p-3.5 ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
                    <a.icon size={18} aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-ink-900">{a.title}</span>
                    <span className="block text-xs leading-snug text-ink-500">{a.text}</span>
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
          <section id="categorias" className="container-xl py-14">
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
          {/* Ofertas: panel oscuro redondeado con el contador a la derecha. */}
          <section id="ofertas" className="container-xl">
            <div className="rounded-[28px] bg-ink px-4 py-6 text-white sm:px-6 sm:py-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-300">
                    <Timer size={13} aria-hidden /> Ofertas relámpago
                  </p>
                  <h2 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
                    Los descuentos más grandes de la semana
                  </h2>
                  <p className="mt-1 max-w-xl text-sm text-white/60">
                    Stock limitado en depósito. A la medianoche, hora Córdoba, estos precios vuelven a la lista.
                  </p>
                </div>
                <div className="text-right">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Termina en</p>
                  {/* El contador va con `tono="oscuro"`: el panel es `bg-ink` y las
                      cajitas de los digitos necesitan el tono claro de la variante
                      oscura para no desvanecerse en el fondo. */}
                  <Countdown label="" tono="oscuro" />
                </div>
              </div>
              <div className="mt-6">
                <ProductRow products={deals.map(toView)} label="las ofertas" />
              </div>
            </div>
          </section>
      </>
    ),
    "pagos-retiro": () => (
      <>
          <section className="container-xl grid gap-4 py-8 md:grid-cols-2">
            <article className="rounded-[28px] bg-surface p-6 ring-1 ring-black/5">
              <div className="mb-4 h-1 w-14 rounded-full bg-emerald-500" />
              <Wallet size={22} className="text-emerald-700" aria-hidden />
              <h3 className="mt-3 text-xl font-extrabold tracking-tight text-ink-900">Transferencia o efectivo en el local</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">
                Te mostramos el CBU cuando confirmás el pedido, no antes. En el local también podés pagar en efectivo o seña.
                Nunca te pedimos una clave, un código ni un token por chat.
              </p>
              <Link href="/ayuda" className="mt-4 inline-block text-sm font-bold text-brand-700 hover:text-brand-800">
                Ver medios de pago
              </Link>
            </article>
            <article className="rounded-[28px] bg-surface p-6 ring-1 ring-black/5">
              <div className="mb-4 h-1 w-14 rounded-full bg-brand-500" />
              <Store size={22} className="text-brand-700" aria-hidden />
              <h3 className="mt-3 text-xl font-extrabold tracking-tight text-ink-900">Retiro en el local</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">
                Comprá online y retirá en {DIRECCION}. {HORARIOS}. Probamos el equipo con vos antes de que te lo lleves.
              </p>
              <a href={WHATSAPP} className="mt-4 inline-block text-sm font-bold text-brand-700 hover:text-brand-800">
                Avisar que paso a retirar
              </a>
            </article>
          </section>
      </>
    ),
    "mas-vendidos": () => (
      <>
          <section className="container-xl py-6">
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
    local: () => (
      <>
          <section id="local" className="container-xl grid gap-4 py-12 lg:grid-cols-2">
            <div className="relative flex min-h-[560px] flex-col justify-end overflow-hidden rounded-[28px] bg-ink text-white">
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
              <div className="relative z-10 space-y-3 px-6 pb-6 pt-8">
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
                    className="inline-flex items-center gap-1.5 rounded-full bg-surface px-4 py-2 text-sm font-bold text-ink-900"
                  >
                    Cómo llegar <ExternalLink size={14} aria-hidden />
                  </a>
                  <a
                    href={WHATSAPP}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-4 py-2 text-sm font-bold text-white"
                  >
                    Consultar por WhatsApp
                  </a>
                </div>
              </div>
            </div>
            <div className="flex flex-col justify-center rounded-[28px] bg-surface p-6 ring-1 ring-black/5 sm:p-8">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-700">Online + local a la calle</p>
              <h2 className="mt-2 text-3xl font-extrabold leading-[1.1] tracking-tight text-ink-900">
                Comprás por internet, pero hay gente real del otro lado
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-ink-500">
                Combinamos la agilidad del e-commerce con la confianza de atender en el centro. Si algo falla, no discutís
                con un chatbot: venís al local o nos escribís por WhatsApp y lo resolvemos.
              </p>
              <ul className="mt-5 space-y-3">
                {[
                  "Probamos el equipo con vos antes de que te lo lleves",
                  "Servicio técnico y gestión de garantía en Córdoba",
                  "Asesoramiento para elegir el modelo correcto",
                  "Emitimos factura o comprobante de compra",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm font-medium text-ink-700">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-wrap gap-2">
                <a
                  href={MAPS}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-ink-900 px-4 py-2.5 text-sm font-bold text-white"
                >
                  Cómo llegar
                </a>
                <a
                  href={WHATSAPP}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-ink-200 px-4 py-2.5 text-sm font-bold text-ink-700 hover:bg-ink-50"
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
            <section className="container-xl py-12">
              <SectionHeading
                eyebrow="Antes de comprar"
                title="Guías cortas, sin relleno"
                action={{ href: "/ayuda", label: "Centro de ayuda" }}
              />
              <div className="grid gap-3 md:grid-cols-3">
                {guides.slice(0, 3).map((g) => (
                  <Link
                    key={g.slug}
                    href={`/${g.slug}`}
                    className="rounded-[24px] bg-surface p-5 ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-700">Guía de compra</p>
                    <h3 className="mt-2 text-lg font-extrabold tracking-tight text-ink-900">{g.title}</h3>
                    {/* Sin bajada: el `subtitle` de la guia es el titulo de SEO en
                        mayusculas y repetiria el titulo de la tarjeta. */}
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-ink-900">
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
          <section id="preguntas" className="container-xl grid gap-4 pb-16 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[28px] bg-surface p-5 ring-1 ring-black/5 sm:p-7">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-700">Antes de comprar</p>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink-900">Preguntas frecuentes</h2>
              <div className="mt-3">
                <FaqAccordion items={FAQ} variant="plano" />
              </div>
              <Link href="/ayuda" className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-brand-700">
                Centro de ayuda <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
            <div className="flex flex-col justify-between rounded-[28px] bg-ink p-6 text-white sm:p-7">
              <div>
                <p className="inline-flex rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white/70">
                  Newsletter
                </p>
                <h3 className="mt-4 text-2xl font-extrabold tracking-tight">Novedades y ofertas de Córdoba Digital</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/65">Ingresos de depósito y ofertas fuertes. No un mail por día.</p>
              </div>
              <div className="mt-6">
                <NewsletterForm />
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
