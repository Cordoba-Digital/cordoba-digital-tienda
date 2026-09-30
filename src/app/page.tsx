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
import { getBestSellers, getCategoryTree, getDealProducts, getFeaturedProducts, getProductCount } from "@/lib/queries";

export const dynamic = "force-dynamic";

const TRUST = [
  { icon: "\ud83d\ude9a", title: "Env\u00edos a todo el pa\u00eds", text: "Por Andreani, a domicilio o a sucursal \u00b7 con seguimiento" },
  { icon: "\ud83d\udd12", title: "Pagos 100% seguros", text: "Tarjetas, Mercado Pago, transferencia y USDT" },
  { icon: "\ud83d\udee1\ufe0f", title: "Compra garantizada", text: "Garant\u00eda legal de 6 meses y soporte post-venta propio" },
  { icon: "\ud83c\udfa7", title: "Post-venta real", text: "Te atendemos por WhatsApp, mail y en el local" },
];

const FAQ = [
  {
    q: "\u00bfCu\u00e1nto tarda el env\u00edo?",
    a: "Despachamos a todo el pa\u00eds con Andreani. Pod\u00e9s elegir entrega a domicilio o retiro en la sucursal m\u00e1s cercana.",
  },
  {
    q: "\u00bfLos productos son nuevos y con garant\u00eda?",
    a: "S\u00ed. Todos los productos son nuevos y cuentan con 6 meses de garant\u00eda legal a partir de la entrega (Ley 24.240), con servicio t\u00e9cnico propio en el local.",
  },
  {
    q: "\u00bfQu\u00e9 medios de pago aceptan?",
    a: "Transferencia bancaria, USDT por red TRC20, efectivo o transferencia en el local (retiro en 27 de Abril 259) y Mercado Pago.",
  },
  {
    q: "\u00bfPuedo pagar en cuotas?",
    a: "S\u00ed, hasta 6 cuotas sin inter\u00e9s con todas las tarjetas y hasta 12 cuotas fijas. Ves el valor exacto de la cuota antes de confirmar.",
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
  const storeImage = "https://www.cordobadigital.net/images/logo.png";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Store",
            name: "C\u00f3rdoba Digital",
            image: storeImage,
            telephone: "+543516777774",
            email: "consultas@cordobadigital.net",
            priceRange: "$$",
            address: {
              "@type": "PostalAddress",
              streetAddress: "27 de Abril 259",
              addressLocality: "C\u00f3rdoba",
              postalCode: "5000",
              addressCountry: "AR",
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
          eyebrow="Explor\u00e1"
          title="Categor\u00edas"
          description="Todo el cat\u00e1logo organizado para que encuentres lo que busc\u00e1s en menos de 3 clics."
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
              <span className="text-[11px] text-ink-400">{c.count} productos</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-surface py-12">
        <div className="container-xl">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <Pill tone="danger">Ofertas rel\u00e1mpago</Pill>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-ink-900 md:text-3xl">
                Los descuentos m\u00e1s grandes de la semana
              </h2>
              <p className="mt-1 text-sm text-ink-500">Stock limitado. Los precios vuelven a la normalidad a la medianoche.</p>
            </div>
            <Countdown />
          </div>
          <ProductRow products={deals.map(toView)} />
        </div>
      </section>

      <section className="container-xl py-12">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: "\ud83c\udfe6",
              title: "Transferencia, USDT o efectivo en el local",
              text: "Te mostramos el CBU o la wallet al confirmar. Tambi\u00e9n pod\u00e9s pagar al retirar.",
              tone: "from-emerald-500 to-emerald-400",
            },
            {
              icon: "\ud83d\udcb3",
              title: "Hasta 6 cuotas sin inter\u00e9s",
              text: "Visa, Mastercard, Amex, Naranja X y Cabal. Ves el valor de la cuota antes de pagar.",
              tone: "from-brand-600 to-brand-400",
            },
            {
              icon: "\ud83c\udfec",
              title: "Retiro en el local",
              text: "Compr\u00e1 online y retir\u00e1 en 27 de Abril 259. Probamos el producto con vos.",
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
          title="Los m\u00e1s vendidos"
          description="Lo que m\u00e1s sale de nuestro dep\u00f3sito esta semana, con stock confirmado."
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
              alt="Fachada del local de C\u00f3rdoba Digital en 27 de Abril 259, C\u00f3rdoba Capital"
              width={1400}
              height={882}
              className="h-full min-h-[18rem] w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950/85 via-ink-950/25 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 text-white">
              <p className="text-2xl font-black tracking-tight">C\u00f3rdoba Digital</p>
              <p className="mt-1 text-sm text-ink-200">Tecnolog\u00eda con garant\u00eda desde 2006</p>
              <dl className="mt-3 grid gap-1.5 text-sm text-ink-100">
                <div className="flex items-center gap-2">
                  <span aria-hidden>\ud83d\udccd</span>
                  <span>27 de Abril 259, C\u00f3rdoba Capital</span>
                </div>
                <div className="flex items-center gap-2">
                  <span aria-hidden>\ud83d\udd51</span>
                  <span>Lun a Vie 14:00 a 18:30 \u00b7 S\u00e1b 12:00 a 14:30</span>
                </div>
                <div className="flex items-center gap-2">
                  <span aria-hidden>\ud83d\udcde</span>
                  <span>+54 351 677-7774</span>
                </div>
              </dl>
            </div>
          </div>
          <div className="p-7 lg:p-10">
            <Pill tone="brand">Online + local a la calle</Pill>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-ink-900 md:text-3xl">
              Compr\u00e1s por internet, pero hay gente real del otro lado
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-500">
              Desde 2006 combinamos la agilidad del e-commerce con la confianza de la atenci\u00f3n presencial. Si algo falla,
              no ten\u00e9s que discutir con un chatbot: ven\u00eds al local o nos escrib\u00eds por WhatsApp y lo resolvemos.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm text-ink-700">
              {[
                "Probamos el equipo con vos antes de que te lo lleves",
                "Servicio t\u00e9cnico y gesti\u00f3n de garant\u00eda en C\u00f3rdoba",
                "Asesoramiento para elegir el modelo correcto",
                "Emitimos factura o comprobante de compra",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-700">
                    \u2713
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="https://maps.google.com/?q=27+de+Abril+259+C\u00f3rdoba+Argentina"
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-700"
              >
                C\u00f3mo llegar
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
            eyebrow="Selecci\u00f3n del equipo"
            title="Destacados de la semana"
            description="Los productos que recomendamos por rendimiento, precio y disponibilidad."
            action={{ href: "/productos", label: "Ver cat\u00e1logo" }}
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
          <h3 className="mt-3 text-2xl font-extrabold">Novedades y ofertas de C\u00f3rdoba Digital</h3>
          <p className="mt-2 text-sm text-ink-200">Dejanos tu mail y te avisamos los ingresos nuevos y las ofertas.</p>
          <div className="mt-5">
            <NewsletterForm />
          </div>
        </div>
      </section>
    </>
  );
}
