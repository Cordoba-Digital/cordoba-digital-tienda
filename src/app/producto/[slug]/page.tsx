import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductCard } from "@/components/product-card";
import {
  BuyBox,
  MobileBuyBar,
  ProductGallery,
  RatingSummary,
  ReviewForm,
  ShippingCalculator,
} from "@/components/product-detail";
import { Pill, Stars } from "@/components/ui";
import { formatDate, money } from "@/lib/format";
import { toView } from "@/lib/product-view";
import { getProductBreadcrumbs, getProductBySlug, getRelatedProducts, getReviewsForProduct } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug).catch(() => null);
  if (!product) return { title: "Producto no encontrado" };
  const description = product.seoDescription || product.shortDescription || product.name;
  return {
    title: product.seoTitle || product.name,
    description,
    alternates: { canonical: `/producto/${product.slug}` },
    openGraph: {
      title: product.seoTitle || product.name,
      description,
      type: "website",
      images: product.images?.[0] ? [product.images[0]] : undefined,
    },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [related, productReviews, breadcrumbs] = await Promise.all([
    getRelatedProducts(product.slug, product.categorySlug, 4),
    getReviewsForProduct(product.slug),
    getProductBreadcrumbs(product.slug),
  ]);

  const buyBoxProduct = {
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    image: product.images?.[0] ?? "",
    price: product.price,
    compareAtPrice: product.compareAtPrice ?? null,
    stock: product.stock,
    freeShipping: product.freeShipping,
    warrantyMonths: product.warrantyMonths,
    sku: product.sku,
  };

  // Google penaliza aggregateRating sin reseñas: WooCommerce no tiene ratings,
  // así que solo lo emitimos si hay opiniones reales cargadas.
  const hasRatings = product.reviewCount > 0;
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: product.images,
    description: product.shortDescription,
    sku: product.sku,
    brand: { "@type": "Brand", name: product.brand },
    offers: {
      "@type": "Offer",
      priceCurrency: "ARS",
      price: (product.price / 100).toFixed(0),
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };
  if (hasRatings) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: (product.rating / 10).toFixed(1),
      reviewCount: product.reviewCount,
    };
  }

  return (
    <div className="container-xl py-6 pb-28 lg:pb-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd),
        }}
      />
      {breadcrumbs.length ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Inicio", item: "/" },
                ...breadcrumbs.map((crumb, i) => ({
                  "@type": "ListItem",
                  position: i + 2,
                  name: crumb.name,
                  item: `/categoria/${crumb.path}`,
                })),
                { "@type": "ListItem", position: breadcrumbs.length + 2, name: product.name },
              ],
            }),
          }}
        />
      ) : null}

      <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-ink-400">
        <Link href="/" className="hover:text-brand-700">
          Inicio
        </Link>
        {breadcrumbs.map((crumb) => (
          <span key={crumb.path} className="flex items-center gap-1.5">
            <span>/</span>
            <Link href={`/categoria/${crumb.path}`} className="hover:text-brand-700">
              {crumb.name}
            </Link>
          </span>
        ))}
        <span>/</span>
        <span className="font-semibold text-ink-700">{product.brand}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-8">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Pill tone="brand">{product.brand}</Pill>
              {product.freeShipping ? <Pill tone="success">🚚 Envío gratis</Pill> : null}
              {product.stock > 0 && product.stock <= 5 ? <Pill tone="amber">Últimas unidades</Pill> : null}
            </div>
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-ink-900 md:text-3xl">
              {product.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-ink-500">
              {hasRatings ? (
                <span className="flex items-center gap-1.5">
                  <Stars rating={product.rating} />
                  <span className="font-semibold text-ink-700">{(product.rating / 10).toFixed(1)}</span>
                  <a href="#opiniones" className="underline-offset-2 hover:underline">
                    ({product.reviewCount} opiniones)
                  </a>
                </span>
              ) : null}
              {product.soldCount > 0 ? <span>· +{product.soldCount} vendidos</span> : null}
              {product.sku ? <span>· SKU {product.sku}</span> : null}
            </div>
          </div>

          <ProductGallery
            images={product.images}
            srcSets={product.imageSrcSets}
            name={product.name}
            badge={product.badge}
          />

          {product.highlights.length ? (
            <div className="card-surface p-5">
              <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-ink-400">Lo más destacado</h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {product.highlights.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-ink-700">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-700">
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <ShippingCalculator price={product.price} />

          <section className="card-surface p-5">
            <h2 className="mb-3 text-lg font-extrabold text-ink-900">Descripción</h2>
            {product.descriptionHtml ? (
              // El HTML viene saneado por el migrador (scripts, estilos y
              // handlers inline ya eliminados). Ver scripts/migrate-wp.ts.
              <div
                className="prose-cd"
                dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
              />
            ) : (
              <p className="text-sm leading-relaxed text-ink-600">
                {product.description || product.shortDescription}
              </p>
            )}
          </section>

          <section className="card-surface p-5">
            <h2 className="mb-3 text-lg font-extrabold text-ink-900">Ficha técnica</h2>
            <dl className="divide-y divide-ink-50">
              {product.specs.map((item) => (
                <div key={item.label} className="grid grid-cols-[10rem_1fr] gap-3 py-2.5 text-sm">
                  <dt className="font-semibold text-ink-500">{item.label}</dt>
                  <dd className="text-ink-800">{item.value}</dd>
                </div>
              ))}
              <div className="grid grid-cols-[10rem_1fr] gap-3 py-2.5 text-sm">
                <dt className="font-semibold text-ink-500">Garantía</dt>
                <dd className="text-ink-800">{product.warrantyMonths} meses oficial</dd>
              </div>
            </dl>
          </section>

          <section id="opiniones" className="card-surface space-y-5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-extrabold text-ink-900">Opiniones de clientes</h2>
              <ReviewForm slug={product.slug} />
            </div>
            <RatingSummary rating={product.rating} count={product.reviewCount} reviews={productReviews} />
            <div className="space-y-4 border-t border-ink-50 pt-4">
              {productReviews.length === 0 ? (
                <p className="text-sm text-ink-500">Todavía no hay opiniones. ¡Sé el primero en opinar!</p>
              ) : (
                productReviews.map((review) => (
                  <article key={review.id} className="border-b border-ink-50 pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <Stars rating={review.rating * 10} />
                      {review.verified ? <Pill tone="success">Compra verificada</Pill> : null}
                    </div>
                    {review.title ? <h3 className="mt-1.5 text-sm font-bold text-ink-900">{review.title}</h3> : null}
                    <p className="mt-1 text-sm leading-relaxed text-ink-600">{review.body}</p>
                    <p className="mt-1.5 text-[11px] text-ink-400">
                      {review.author} · {formatDate(review.createdAt)}
                    </p>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>

        <div>
          <BuyBox product={buyBoxProduct} />
        </div>
      </div>

      {related.length ? (
        <section className="mt-14">
          <h2 className="mb-5 text-xl font-extrabold tracking-tight text-ink-900">
            Quienes vieron esto también compraron
          </h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.slug} product={toView(item)} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-14 grid gap-4 rounded-3xl bg-surface p-6 md:grid-cols-3">
        {[
          { icon: "🛡️", title: "Garantía oficial", text: `${product.warrantyMonths} meses cubiertos por el fabricante y gestionados por nosotros.` },
          { icon: "🔄", title: "Cambios sin drama", text: "Tenés 10 días corridos para cambiar el producto si no era lo que esperabas." },
          { icon: "💬", title: "Asesoramiento real", text: "Preguntanos por WhatsApp antes de comprar: te respondemos en minutos." },
        ].map((item) => (
          <div key={item.title} className="flex items-start gap-3">
            <span className="text-2xl">{item.icon}</span>
            <div>
              <p className="text-sm font-bold text-ink-900">{item.title}</p>
              <p className="text-xs leading-relaxed text-ink-500">{item.text}</p>
            </div>
          </div>
        ))}
      </section>

      <p className="mt-8 text-center text-xs text-ink-400">
        Precio de lista {money(product.price)} · Los precios pueden variar sin previo aviso según disponibilidad.
      </p>

      <MobileBuyBar product={buyBoxProduct} />
    </div>
  );
}
