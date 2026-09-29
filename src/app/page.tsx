import Link from "next/link";

import { Countdown } from "@/components/countdown";
import { NewsletterForm } from "@/components/newsletter-form";
import { ProductCard, ProductRow } from "@/components/product-card";
import { ProductImg } from "@/components/product-img";
import { Pill, SectionHeading, Stars } from "@/components/ui";
import { FREE_SHIPPING_THRESHOLD, money } from "@/lib/format";
import { getGoogleReviews } from "@/lib/google-reviews";
import { toView } from "@/lib/product-view";
import { getBestSellers, getCategoryTree, getDealProducts, getFeaturedProducts, getProductCount } from "@/lib/queries";

export const dynamic = "force-dynamic";

const TRUST = [
  { icon: "🚚", title: "Envíos a todo el país", text: `Gratis desde ${money(FREE_SHIPPING_THRESHOLD)} · seguimiento online` },
  { icon: "🔒", title: "Pagos 100% seguros", text: "Tarjetas, Mercado Pago, transferencia y USDT" },
  { icon: "🛡️", title: "Compra garantizada", text: "12 meses de garantía oficial en todos los productos" },
  { icon: "🎧", title: "Post-venta real", text: "Te atendemos por WhatsApp, mail y en el local" },
];

const FAQ = [
  {
    q: "¿Cuánto tarda el envío?",
    a: "Entre 24 y 72 horas hábiles según tu zona. En Córdoba Capital tenemos moto express en el día y retiro en el local en 2 horas.",
  },
  {
    q: "¿Los productos son nuevos y con garantía?",
    a: "Sí. Todos los productos son nuevos, sellados y con 12 meses de garantía oficial. Emitimos factura A o B.",
  },
  {
    q: "¿Qué descuento tengo pagando por transferencia?",
    a: "15% OFF sobre el precio de lista, tanto en transferencia bancaria como en USDT. El descuento se calcula automáticamente en el checkout.",
  },
  {
    q: "¿Puedo pagar en cuotas?",
    a: "Sí, hasta 6 cuotas sin interés con todas las tarjetas y hasta 12 cuotas fijas. Ves el valor exacto de la cuota antes de confirmar.",
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

  // Las 10 categorías raíz con más stock mandan la grilla de la home.
  const topCategories = categories.slice(0, 10);

  const ratingValue = googleReviews.rating?.toFixed(1) ?? null;
  const reviewCount = googleReviews.count;
  // El CUIT real lo pasa el cliente. Mientras tanto no se imprime ninguno: un
  // CUIT inventado en el footer y en la factura es un problema legal.
  const cuit = process.env.STORE_CUIT?.trim() ?? "";

  const heroProduct = featured[0] ? toView(featured[0]) : null;
  // Foto del hero: una imagen real del catálogo. Antes apuntaba a un archivo
  // que no existía en /public (404).
  const heroImage = deals[0]?.images?.[0] ?? featured[0]?.images?.[0] ?? heroProduct?.image ?? "";
  const storeImage = "https://www.cordobadigital.net/images/logo.png";

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
              streetAddress: "27 de Abril 259",
              addressLocality: "Córdoba",
              postalCode: "5000",
              addressCountry: "AR",
            },
            // `aggregateRating` solo se emite con reseñas reales: Google
            // penaliza un rating sin opinions y un 4,8★ de mentira figura
            // como dato estructurado falso.
            ...(ratingValue && reviewCount
              ? { aggregateRating: { "@type": "AggregateRating", ratingValue, reviewCount: String(reviewCount) } }
              : {}),
          }),
        }}
      />

      {/* HERO */}
      <section className="mesh-dark relative overflow-hidden">
        <div className="container-xl relative grid items-center gap-10 py-14 lg:grid-cols-[1.05fr_1fr] lg:py-20">
          <div className="animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur">
              <span className="h-2 w-2 animate-pulse rounded-full bg-neon-400" />
              Local en 27 de Abril 259 · Envíos a todo el país
            </span>
            <h1 className="mt-5 text-balance-pretty text-4xl font-black leading-[1.05] tracking-tight text-white md:text-5xl lg:text-[3.4rem]">
              Tecnología que llega
              <span className="bg-gradient-to-r from-neon-400 to-brand-300 bg-clip-text text-transparent"> rápido, segura y con garantía</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-200 md:text-lg">
              Celulares, notebooks, cámaras, drones y gaming con stock real. Comprá online en 2 minutos, pagá como
              quieras y seguí tu pedido paso a paso.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/productos"
                className="rounded-xl bg-gradient-to-r from-brand-500 to-neon-500 px-6 py-3.5 text-sm font-extrabold text-white shadow-[0_18px_40px_-16px_rgba(194,65,12,0.55)] transition hover:opacity-95"
              >
                Ver catálogo completo
              </Link>
              <Link
                href="/productos?ofertas=1"
                className="rounded-xl border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-bold text-white backdrop-blur transition hover:bg-white/10"
              >
                🔥 Ofertas de la semana
              </Link>
            </div>

            <dl className="mt-9 grid max-w-xl grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                // Cifras reales: el catálogo viene de WooCommerce y el resto son
                // datos del negocio. No inventamos "clientes felices" ni años.
                { k: new Intl.NumberFormat("es-AR").format(productCount), v: "productos en catálogo" },
                { k: "12 meses", v: "de garantía oficial" },
                { k: "24-72 h", v: "de entrega" },
                ...(ratingValue && reviewCount
                  ? [{ k: `${ratingValue}★`, v: `${reviewCount} reseñas en Google` }]
                  : []),
              ].map((stat) => (
                <div key={stat.v} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 backdrop-blur">
                  <dt className="text-lg font-black text-white">{stat.k}</dt>
                  <dd className="text-[11px] font-medium uppercase tracking-wide text-ink-300">{stat.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
              {heroImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={heroImage}
                  alt={`${deals[0]?.name ?? "Productos de tecnología"} en Córdoba Digital`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="mesh-dark grid h-full min-h-[22rem] place-items-center text-center text-white">
                  <p className="px-6 text-sm text-ink-300">
                    Actualizando el catálogo con los productos de Córdoba Digital…
                  </p>
                </div>
              )}
            </div>

            {heroProduct ? (
              <Link
                href={`/producto/${heroProduct.slug}`}
                className="absolute -bottom-5 left-2 hidden w-[17rem] animate-float-slow rounded-2xl border border-ink-100 bg-white/95 p-3 shadow-2xl backdrop-blur sm:block"
              >
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={heroProduct.image} alt="" className="h-14 w-14 rounded-xl object-cover" />
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-xs font-bold text-ink-800">{heroProduct.name}</p>
                    <p className="text-sm font-black text-ink-900">{money(heroProduct.price)}</p>
                    <p className="text-[11px] font-semibold text-emerald-600">6 cuotas sin interés</p>
                  </div>
                </div>
              </Link>
            ) : null}

            <div className="absolute -right-2 top-6 hidden animate-float-slow rounded-2xl border border-white/15 bg-ink-900/80 px-4 py-3 text-white backdrop-blur md:block">
              <p className="text-[11px] uppercase tracking-wide text-ink-300">Pagando con transferencia</p>
              <p className="text-xl font-black text-neon-400">15% OFF</p>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <section className="border-b border-ink-100 bg-white">
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

      {/* CATEGORÍAS */}
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
              <span className="text-[11px] text-ink-400">{c.count} productos</span>
            </Link>
          ))}
        </div>
      </section>

      {/* OFERTAS */}
      <section className="bg-white py-12">
        <div className="container-xl">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <Pill tone="danger">🔥 Ofertas relámpago</Pill>
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

      {/* BENEFICIOS DE PAGO */}
      <section className="container-xl py-12">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: "🏦",
              title: "15% OFF con transferencia o USDT",
              text: "El descuento se aplica solo al elegir el medio de pago. Sin letra chica.",
              tone: "from-emerald-500 to-emerald-400",
            },
            {
              icon: "💳",
              title: "Hasta 6 cuotas sin interés",
              text: "Visa, Mastercard, Amex, Naranja X y Cabal. Ves el valor de la cuota antes de pagar.",
              tone: "from-brand-600 to-brand-400",
            },
            {
              icon: "🏬",
              title: "Retiro en 2 horas en el centro",
              text: "Comprá online y retirá en 27 de Abril 259. Probamos el producto con vos.",
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

      {/* MÁS VENDIDOS */}
      <section className="container-xl py-6">
        <SectionHeading
          eyebrow="Elegidos por los cordobeses"
          title="Los más vendidos"
          description="Lo que más sale de nuestro depósito esta semana, con stock confirmado."
          action={{ href: "/productos?orden=vendidos", label: "Ver ranking" }}
        />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {bestSellers.slice(0, 8).map((p) => (
            <ProductCard key={p.slug} product={toView(p)} />
          ))}
        </div>
      </section>

      {/* LOCAL */}
      <section className="container-xl py-14">
        <div className="grid items-center gap-8 overflow-hidden rounded-3xl border border-ink-100 bg-white lg:grid-cols-2">
          <div className="relative h-full min-h-[18rem]">
            <div className="relative h-full min-h-[18rem] overflow-hidden">
              <ProductImg
                src="/images/local-cordoba-1400.jpg"
                srcSet={[
                  "/images/local-cordoba-700.jpg 700w",
                  "/images/local-cordoba-1400.jpg 1400w",
                ]}
                sizes="(max-width: 1024px) 100vw, 40vw"
                alt="Fachada del local de Córdoba Digital en 27 de Abril 259, Córdoba Capital"
                width={1400}
                height={882}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink-950/85 via-ink-950/25 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                <p className="text-2xl font-black tracking-tight">Córdoba Digital</p>
                <p className="mt-1 text-sm text-ink-200">Tecnología con garantía desde 2006</p>
                <dl className="mt-3 grid gap-1.5 text-sm text-ink-100">
                  <div className="flex items-center gap-2">
                    <span aria-hidden>📍</span>
                    <span>27 de Abril 259, Córdoba Capital</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span aria-hidden>🕑</span>
                    <span>Lun a Vie 14:00 a 18:30 · Sáb 11:00 a 14:00</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span aria-hidden>📞</span>
                    <span>+54 351 677-7774</span>
                  </div>
                </dl>
              </div>
            </div>
          </div>
          <div className="p-7 lg:p-10">
            <Pill tone="brand">Online + local a la calle</Pill>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-ink-900 md:text-3xl">
              Comprás por internet, pero hay gente real del otro lado
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-500">
              Desde 2006 combinamos la agilidad del e-commerce con la confianza de la atención presencial. Si algo falla,
              no tenés que discutir con un chatbot: venís al local o nos escribís por WhatsApp y lo resolvemos.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm text-ink-700">
              {[
                "Probamos el equipo con vos antes de que te lo lleves",
                "Servicio técnico y gestión de garantía en Córdoba",
                "Asesoramiento para elegir el modelo correcto",
                "Facturación A/B para empresas y monotributistas",
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
                href="https://maps.google.com/?q=27+de+Abril+259+Córdoba+Argentina"
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-ink-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-700"
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

      {/* DESTACADOS */}
      <section className="bg-white py-12">
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

      {/* RESEÑAS DE GOOGLE — solo si hay API key configurada */}
      <section className="container-xl py-14">
        {googleReviews.fallback ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                icon: "🛡️",
                title: "Garantía oficial",
                text: "Todos los productos con garantía del fabricante y post-venta propio en Córdoba.",
              },
              {
                icon: "🚚",
                title: "Envíos a todo el país",
                text: `Despachamos a todas las provincias con seguimiento online. Gratis desde ${money(FREE_SHIPPING_THRESHOLD)}.`,
              },
              {
                icon: "🏬",
                title: "Local a la calle",
                text: "27 de Abril 259, Córdoba Capital. Retirá en el día o consultá antes de venir.",
              },
            ].map((item) => (
              <div key={item.title} className="card-surface flex flex-col gap-2 p-5">
                <span className="text-2xl" aria-hidden>
                  {item.icon}
                </span>
                <p className="text-sm font-bold text-ink-900">{item.title}</p>
                <p className="text-sm leading-relaxed text-ink-600">{item.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="mb-8 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-white px-5 py-3">
                <span className="text-3xl font-black text-ink-900">{ratingValue}</span>
                <div>
                  <Stars rating={Math.round((googleReviews.rating ?? 0) * 10)} size="md" />
                  <p className="text-xs text-ink-500">{reviewCount} opiniones en Google</p>
                </div>
              </div>
              <p className="text-sm text-ink-500">
                Opiniones reales de nuestra ficha de Google.{" "}
                <a
                  href={googleReviews.placeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-brand-700 underline"
                >
                  Ver todas en Google Maps
                </a>
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {googleReviews.reviews.map((t) => (
                <figure
                  key={`${t.author}-${t.text.slice(0, 24)}`}
                  className="card-surface flex h-full flex-col gap-3 p-5"
                >
                  <Stars rating={t.rating * 10} />
                  <blockquote className="text-sm leading-relaxed text-ink-700">“{t.text}”</blockquote>
                  <figcaption className="mt-auto text-xs font-semibold text-ink-900">
                    {t.author}
                    <span className="block font-normal text-ink-400">Reseña de Google</span>
                  </figcaption>
                </figure>
              ))}
            </div>
            <p className="mt-4 text-[11px] text-ink-400">Fuente: Google Maps · se actualizan cada 24 h.</p>
          </>
        )}
      </section>

      {/* FAQ + NEWSLETTER */}
      <section className="container-xl grid gap-8 pb-16 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <SectionHeading eyebrow="Antes de comprar" title="Preguntas frecuentes" action={{ href: "/ayuda", label: "Centro de ayuda" }} />
          <div className="space-y-3">
            {FAQ.map((item) => (
              <details key={item.q} className="card-surface group p-4 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-bold text-ink-900">
                  {item.q}
                  <span className="text-lg text-ink-300 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2.5 text-sm leading-relaxed text-ink-500">{item.a}</p>
              </details>
            ))}
          </div>
        </div>

        <div className="mesh-dark flex flex-col justify-center rounded-3xl p-7 text-white">
          <Pill tone="dark" className="w-fit bg-white/10">Newsletter</Pill>
          <h3 className="mt-3 text-2xl font-extrabold">10% OFF en tu primera compra</h3>
          <p className="mt-2 text-sm text-ink-200">
            Dejanos tu mail y te enviamos el cupón <strong className="text-neon-400">BIENVENIDO10</strong> más los
            ingresos y ofertas antes que nadie.
          </p>
          <div className="mt-5">
            <NewsletterForm />
          </div>
          <p className="mt-3 text-[11px] text-ink-400">Sin spam. Podés darte de baja cuando quieras.</p>
        </div>
      </section>
    </>
  );
}
