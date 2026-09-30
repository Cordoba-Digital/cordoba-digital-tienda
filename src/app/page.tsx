import type { Metadata } from "next";
import Link from "next/link";

import { Countdown } from "@/components/countdown";
import { FaqAccordion } from "@/components/faq-accordion";
import { HomeHero } from "@/components/home-hero";
import { NewsletterForm } from "@/components/newsletter-form";
import { ProductCard, ProductRow } from "@/components/product-card";
import { ProductImg } from "@/components/product-img";
import { Pill, SectionHeading } from "@/components/ui";
import { getGoogleReviews } from "@/lib/google-reviews";
import { toView } from "@/lib/product-view";
import { url } from "@/lib/site";
import { getBestSellers, getCategoryTree, getDealProducts, getFeaturedProducts, getProductCount } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  // La home no tenía canonical y era la única que se indexaba sin señalar
  // dónde está la versión buena. Con esto toda página indexable declara la suya.
  alternates: { canonical: "/" },
};

const TRUST = [
  { icon: "🚚", title: "Envíos a todo el país", text: "Por Andreani, a domicilio o a sucursal · con seguimiento" },
  { icon: "🔒", title: "Pagos 100% seguros", text: "Tarjetas, Mercado Pago, transferencia y USDT" },
  { icon: "🛡️", title: "Compra garantizada", text: "Garantía legal de 6 meses y soporte post-venta propio" },
  { icon: "🎧", title: "Post-venta real", text: "Te atendemos por WhatsApp, mail y en el local" },
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
    a: "Transferencia bancaria, USDT por red TRC20, efectivo o transferencia en el local (retiro en 27 de Abril 180) y Mercado Pago.",
  },
];

export default async function HomePage() {
  const [featured, deals, bestSellers, categories, googleReviews, productCount] = await Promise.all([
    getFeaturedProducts(8),
    getDealProducts(8),
    getBestSellers(8),
    getCategoryTree(),
    getGoogleReviews(),
    getProductCount(),
  ]);

  const topCategories = categories.slice(0, 10);
  const ratingValue = googleReviews.rating?.toFixed(1) ?? null;
  const reviewCount = googleReviews.count;
  const heroProduct = featured[0] ? toView(featured[0]) : null;
  // El logo vive en /public, así que la imagen de Open Graph y la del JSON-LD
  // salen del propio sitio. Antes apuntaban al dominio viejo, con lo cual la
  // vista previa al compartir en redes dependía de que el sitio original
  // estuviera arriba.
  const storeImage = url("/images/logo.png");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Store",
            name: "Córdoba Digital",
            image: storeImage,
            telephone: "+543516777774",
            email: "consultas@cordobadigital.net",
            priceRange: "$$",
            address: {
              "@type": "PostalAddress",
              streetAddress: "27 de Abril 180",
              addressLocality: "Córdoba",
              addressCountry: "AR",
              // Sin `postalCode` a propósito: el sitio original no publica
              // ningún código postal. Poner un 5000 seria un dato estructurado
              // falso, y Google toma lo del JSON-LD para el panel de negocio.
            },
            ...(ratingValue && reviewCount
              ? { aggregateRating: { "@type": "AggregateRating", ratingValue, reviewCount: String(reviewCount) } }
              : {}),
          }),
        }}
      />

      <HomeHero productCount={productCount} ratingValue={ratingValue} reviewCount={reviewCount} featured={heroProduct} />

      <section className="border-b border-ink-100 bg-surface">
        <div className="container-xl grid gap-3 py-5 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map((t) => (
            <div key={t.title} className="flex items-start gap-3 rounded-xl px-2 py-2">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-xl">{t.icon}</span>
              <div>
                <p className="text-sm font-bold text-ink-900">{t.title}</p>
                <p className="text-xs leading-snug text-ink-500">{t.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container-xl py-12">
        <SectionHeading
          eyebrow="Explorá"
          title="Categorías"
          description="Todo el catálogo organizado para que encuentres lo que buscás en menos de 3 clics."
          action={{ href: "/productos", label: "Ver todo" }}
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {topCategories.map((c) => (
            <Link
              key={c.slug}
              href={`/categoria/${c.path}`}
              className="group card-surface flex flex-col gap-1.5 p-4 transition hover:-translate-y-1 hover:border-brand-200 hover:shadow-lg"
            >
              <span className="text-2xl transition group-hover:scale-110">{c.icon}</span>
              <span className="text-sm font-bold text-ink-900">{c.name}</span>
              <span className="text-[11px] text-ink-500">{c.count} productos</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-surface py-12">
        <div className="container-xl">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <Pill tone="danger">Ofertas relámpago</Pill>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-ink-900 md:text-3xl">
                Los descuentos más grandes de la semana
              </h2>
              <p className="mt-1 text-sm text-ink-500">Stock limitado. Los precios vuelven a la normalidad a la medianoche.</p>
            </div>
            <Countdown />
          </div>
          <ProductRow products={deals.map(toView)} />
        </div>
      </section>

      <section className="container-xl py-12">
        {/* Eran tres tarjetas y la del medio anunciaba "Hasta 6 cuotas sin
            interés" con la lista de tarjetas. No hay cuotas en el sitio
            original, así que quedan dos y la grilla pasa a dos columnas. */}
        <div className="grid gap-4 md:grid-cols-2">
          {[
            {
              icon: "🏦",
              title: "Transferencia, USDT o efectivo en el local",
              text: "Te mostramos el CBU o la wallet al confirmar. También podés pagar al retirar.",
              tone: "from-emerald-500 to-emerald-400",
            },
            {
              icon: "🏬",
              title: "Retiro en el local",
              text: "Comprá online y retirá en 27 de Abril 180. Probamos el producto con vos.",
              tone: "from-ink-900 to-ink-700",
            },
          ].map((b) => (
            <div key={b.title} className="card-surface overflow-hidden">
              <div className={`h-1.5 w-full bg-gradient-to-r ${b.tone}`} />
              <div className="p-5">
                <span className="text-2xl">{b.icon}</span>
                <h3 className="mt-2 text-base font-extrabold text-ink-900">{b.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-500">{b.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container-xl py-6">
        <SectionHeading
          eyebrow="Elegidos por los cordobeses"
          title="Los más vendidos"
          description="Lo que más sale de nuestro depósito esta semana, con stock confirmado."
          action={{ href: "/productos?orden=vendidos", label: "Ver ranking" }}
        />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {bestSellers.slice(0, 8).map((p) => (
            <ProductCard key={p.slug} product={toView(p)} />
          ))}
        </div>
      </section>

      <section className="container-xl py-14">
        <div className="grid items-center gap-8 overflow-hidden rounded-3xl border border-ink-100 bg-surface lg:grid-cols-2">
          <div className="relative h-full min-h-[18rem]">
            <ProductImg
              src="/images/local-cordoba-1400.jpg"
              srcSet={["/images/local-cordoba-700.jpg 700w", "/images/local-cordoba-1400.jpg 1400w"]}
              sizes="(max-width: 1024px) 100vw, 40vw"
              alt="Fachada del local de Córdoba Digital en 27 de Abril 180, Córdoba Capital"
              width={1400}
              height={882}
              className="h-full min-h-[18rem] w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950/85 via-ink-950/25 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 text-white">
              <p className="text-2xl font-black tracking-tight">Córdoba Digital</p>
              <p className="mt-1 text-sm text-ink-200">Tecnología con garantía legal</p>
              <dl className="mt-3 grid gap-1.5 text-sm text-ink-100">
                <div className="flex items-center gap-2">
                  <span aria-hidden>📍</span>
                  <span>27 de Abril 180, Córdoba Capital</span>
                </div>
                <div className="flex items-center gap-2">
                  <span aria-hidden>🕑</span>
                  <span>Lun a Vie 14:00 a 18:30 · Sáb 12:00 a 14:30</span>
                </div>
                <div className="flex items-center gap-2">
                  <span aria-hidden>📞</span>
                  <span>+54 351 677-7774</span>
                </div>
              </dl>
            </div>
          </div>
          <div className="p-7 lg:p-10">
            <Pill tone="brand">Online + local a la calle</Pill>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-ink-900 md:text-3xl">
              Comprás por internet, pero hay gente real del otro lado
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-500">
              Combinamos la agilidad del e-commerce con la confianza de la atención presencial. Si algo falla, no tenés
              que discutir con un chatbot: venís al local o nos escribís por WhatsApp y lo resolvemos.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm text-ink-700">
              {[
                "Probamos el equipo con vos antes de que te lo lleves",
                "Servicio técnico y gestión de garantía en Córdoba",
                "Asesoramiento para elegir el modelo correcto",
                "Emitimos factura o comprobante de compra",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-700">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="https://maps.google.com/?q=27+de+Abril+180+Córdoba+Argentina"
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-brand-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-800"
              >
                Cómo llegar
              </a>
              <a
                href="https://wa.me/5493516777774"
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-ink-200 px-5 py-3 text-sm font-bold text-ink-700 transition hover:border-emerald-300 hover:text-emerald-700"
              >
                Consultar por WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface py-12">
        <div className="container-xl">
          <SectionHeading
            eyebrow="Selección del equipo"
            title="Destacados de la semana"
            description="Los productos que recomendamos por rendimiento, precio y disponibilidad."
            action={{ href: "/productos", label: "Ver catálogo" }}
          />
          <ProductRow products={featured.map(toView)} />
        </div>
      </section>

      <section className="container-xl grid gap-8 py-14 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div>
          <SectionHeading eyebrow="Antes de comprar" title="Preguntas frecuentes" action={{ href: "/ayuda", label: "Centro de ayuda" }} />
          <FaqAccordion items={FAQ} />
        </div>
        <div className="mesh-dark flex flex-col justify-center rounded-3xl p-7 text-white">
          <Pill tone="dark" className="w-fit bg-white/10">
            Newsletter
          </Pill>
          <h3 className="mt-3 text-2xl font-extrabold">Novedades y ofertas de Córdoba Digital</h3>
          <p className="mt-2 text-sm text-ink-200">Dejanos tu mail y te avisamos los ingresos nuevos y las ofertas.</p>
          <div className="mt-5">
            <NewsletterForm />
          </div>
        </div>
      </section>
    </>
  );
}
