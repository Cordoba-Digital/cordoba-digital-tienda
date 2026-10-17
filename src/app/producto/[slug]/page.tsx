import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductRow } from "@/components/product-card";
import { RefreshCw, Shield, MessageCircle } from "lucide-react";
import {
  BuyBox,
  MobileBuyBar,
  ProductGallery,
  RatingSummary,
  ReviewForm,
} from "@/components/product-detail";
import { Pill, Stars } from "@/components/ui";
import { discountPercent, formatDate, money } from "@/lib/format";
import { toView } from "@/lib/product-view";
import {
  getProductBreadcrumbs,
  getProductBySlug,
  getRelatedProducts,
  getReviewsForProduct,
  getVerifiedRatingStats,
} from "@/lib/queries";
import { url as siteUrl } from "@/lib/site";
import { breadcrumbJsonLd, jsonLdString, ORG_ID, returnPolicy } from "@/lib/structured-data";
import { sanitizeHtml } from "@/lib/sanitize-html";

/**
 * La ficha queda en la caché del CDN y se regenera cada 5 minutos, o en el acto
 * cuando el panel cambia el producto (ver `refreshStorePages`). El checkout
 * vuelve a chequear precio y stock, así que unos minutos de atraso no venden
 * algo que no hay.
 */
export const revalidate = 300;

/** Sin fichas armadas en el build: cada una se genera en la primera visita. */
export function generateStaticParams(): { slug: string }[] {
  return [];
}

/**
 * OJO: esta ruta no puede tener `loading.tsx`.
 *
 * `loading.tsx` envuelve la pagina en un <Suspense>, y Next manda el shell
 * (con el esqueleto) antes de resolver el componente. Para cuando la pagina
 * llama a `notFound()` las cabeceras ya salieron, asi que el status se queda
 * en 200: un soft-404 que Google registra como pagina valida. Sin ese archivo
 * el render bloquea hasta decidir, `notFound()` si es un slug inexistente, y
 * la respuesta sale con 404 de verdad.
 *
 * Por eso `notFound()` va tambien en `generateMetadata`: el titulo tiene que
 * ser el de la pagina de not-found real, no uno propio de la ruta.
 */

type Params = Promise<{ slug: string }>;

/** `decodeURIComponent` tira URIError con `%` sueltos (`foo%bar`). */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** `priceValidUntil` del Offer: `updatedAt + 30 días` en `YYYY-MM-DD`. Null si el dato no es una fecha válida. */
function toPriceValidUntil(updatedAt: unknown): string | null {
  const date = updatedAt instanceof Date ? updatedAt : new Date(updatedAt as string | number);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Resuelve el slug de la URL contra el catalogo.
 *
 * El migrador de WooCommerce dejo 23 slugs con secuencias percent-encoded
 * pegadas dentro del texto: `...samsung-55%e2%80%b3-uhd-4k-q65c` en vez de
 * `...samsung-55-uhd-4k-q65c`. Esos productos son inalcanzables con un lookup
 * directo, y antes del fix de 404 eso terminaba en 23 paginas con 200 y el
 * texto "Producto no encontrado": soft-404s que el sitemap publica y Google
 * indexa como si fueran fichas.
 *
 * Peor: para una misma URL, Next pasa el slug CRUDO a `generateMetadata` y el
 * DECODIFICADO al componente de pagina (comprobado en produccion), asi que no
 * alcanza con mirar uno de los dos. Por eso se prueban las cuatro formas en que
 * puede estar la misma fila —crudo, decodificado, y cada uno re-codificado con
 * el hexadecimal en mayusculas y en minusculas— y se toma la primera que
 * exista. Todas son transformaciones deterministas de la misma cadena: un slug
 * que no existe sigue sin encontrar nada y responde 404.
 */
function slugCandidates(slug: string): string[] {
  const seen = new Set<string>([slug]);
  const add = (value: string) => {
    if (value && value !== slug) seen.add(value);
  };
  const decoded = safeDecode(slug);
  add(decoded);
  for (const base of [slug, decoded]) {
    const encoded = encodeURIComponent(base);
    add(encoded);
    add(encoded.replace(/%[0-9A-F]{2}/g, (m) => m.toLowerCase()));
  }
  return [...seen];
}

async function findProduct(slug: string) {
  for (const candidate of slugCandidates(slug)) {
    const product = await getProductBySlug(candidate);
    if (product) return product;
  }
  return null;
}

/**
 * Las descripciones cortas de WooCommerce llegan a 500 caracteres y Google
 * muestra unos 155: sin recortar, el resultado de búsqueda queda cortado a
 * mitad de palabra. Se corta en el último espacio antes del límite.
 */
function recortarMeta(texto: string, max = 155): string {
  const limpio = texto.replace(/\[cite:[^\]]*\]/gi, "").replace(/\s+/g, " ").trim();
  if (limpio.length <= max) return limpio;
  const corte = limpio.slice(0, max - 1);
  return `${corte.slice(0, corte.lastIndexOf(" ")).replace(/[\s,;:.\-–]+$/, "")}…`;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  // Sin `.catch(() => null)` a proposito: si la base se cae queremos un 500
  // visible, no 2.588 productos respondiendo 404 (eso SI destruye el indice).
  const product = await findProduct(slug);
  if (!product) notFound();
  const description = product.seoDescription || recortarMeta(product.shortDescription) || product.name;
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
  const product = await findProduct(slug);
  if (!product) notFound();

  const [related, productReviews, breadcrumbs, ratingStats] = await Promise.all([
    getRelatedProducts(product),
    getReviewsForProduct(product.slug),
    getProductBreadcrumbs(product.slug),
    getVerifiedRatingStats(product.slug),
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
    rating: ratingStats.rating,
    reviewCount: ratingStats.count,
    soldCount: product.soldCount,
  };

  // Google penaliza aggregateRating sin reseñas y las reseñas autogeneradas:
  // solo cuentan las de compra verificada (pedido pago con este producto).
  const hasRatings = ratingStats.count > 0;

  // Filas estructuradas (AI Commerce): solo las que tengan dato. "Estado" va
  // siempre (la columna tiene default 'Nuevo'). "Liberado" solo tiene sentido
  // en telefonía/wearables: se muestra si la categoría principal lo sugiere
  // (celular, tablet, smartwatch) o si hay modelo cargado.
  const categoryLower = product.categorySlug.toLowerCase();
  const showUnlocked =
    categoryLower.includes("celular") ||
    categoryLower.includes("tablet") ||
    categoryLower.includes("smartwatch") ||
    product.model.trim() !== "";
  const condition = product.condition.trim() || "Nuevo";
  const specRows: { label: string; value: string }[] = [];
  if (product.brand && product.brand !== "General") specRows.push({ label: "Marca", value: product.brand });
  if (product.model.trim()) specRows.push({ label: "Modelo", value: product.model });
  if (product.storage.trim()) specRows.push({ label: "Memoria", value: product.storage });
  if (product.ram.trim()) specRows.push({ label: "RAM", value: product.ram });
  specRows.push({ label: "Estado", value: condition });
  if (showUnlocked) specRows.push({ label: "Liberado", value: product.isUnlocked ? "Sí" : "No" });
  if (product.sku) specRows.push({ label: "SKU", value: product.sku });
  // `weight` y `dimensions` son los del paquete para envío que venían de
  // WooCommerce ("1", "10x10x20 cm" en un celular): no se muestran como
  // características del producto. Las medidas reales van en `specs`.

  const additionalProperty = specRows
    .filter((row) => ["Modelo", "Memoria", "RAM", "Estado", "Liberado"].includes(row.label))
    .map((row) => ({ "@type": "PropertyValue", name: row.label, value: row.value }));

  const priceValidUntil = toPriceValidUntil(product.updatedAt);
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${siteUrl(`/producto/${product.slug}`)}#product`,
    url: siteUrl(`/producto/${product.slug}`),
    name: product.name,
    // Las fotos subidas desde el admin se guardan con ruta relativa.
    image: product.images.map((img) => (img.startsWith("/") ? siteUrl(img) : img)),
    description: product.shortDescription,
    sku: product.sku,
    brand: { "@type": "Brand", name: product.brand },
    ...(additionalProperty.length ? { additionalProperty } : {}),
    offers: {
      "@type": "Offer",
      priceCurrency: "ARS",
      // Precios en pesos enteros (ver `lib/format.ts`): sin dividir entre 100.
      // Esta línea era el último resto del bug de "centavos" que ya se corrigió
      // en el formateo visible y en Mercado Pago; con `/ 100` Google y los
      // comparadores de IA leían precios 100x menores ($33.000 en vez de $3.299.999).
      price: product.price,
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition:
        condition.toLowerCase() === "nuevo"
          ? "https://schema.org/NewCondition"
          : "https://schema.org/UsedCondition",
      ...(priceValidUntil ? { priceValidUntil } : {}),
      url: siteUrl(`/producto/${product.slug}`),
      seller: { "@id": ORG_ID },
      areaServed: "AR",
      hasMerchantReturnPolicy: returnPolicy(),
    },
  };
  if (hasRatings) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: (ratingStats.rating / 10).toFixed(1),
      reviewCount: ratingStats.count,
    };
  }

  return (
    <div className="ficha-rectas container-xl py-6 pb-28 lg:pb-6 lg:pt-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString(jsonLd),
        }}
      />
      {breadcrumbs.length ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdString(
              breadcrumbJsonLd([
                { name: "Inicio", path: "/" },
                ...breadcrumbs.map((crumb) => ({ name: crumb.name, path: `/categoria/${crumb.path}` })),
                { name: product.name },
              ]),
            ),
          }}
        />
      ) : null}

      <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
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

      {/* Ficha en dos columnas: galería a la izquierda y, a la derecha, la caja
          de compra fija al hacer scroll. La caja ocupa las dos filas, así que
          las características suben a la columna izquierda, debajo de la foto,
          en vez de dejar ese hueco vacío. En celular el orden es galería, caja
          de compra y características. */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_25rem] lg:grid-rows-[auto_1fr]">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <ProductGallery
            images={product.images}
            srcSets={product.imageSrcSets}
            name={product.name}
            badge={discountPercent(product.price, product.compareAtPrice) > 0 ? `-${discountPercent(product.price, product.compareAtPrice)}%` : null}
          />
        </div>
        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <BuyBox product={buyBoxProduct} />
        </div>
        <section className="card-surface p-6 lg:col-start-1 lg:row-start-2 lg:self-start">
          <h2 className="mb-3 text-xl font-bold tracking-tight text-ink-900">Características</h2>
          <dl className="divide-y divide-ink-50">
            {/* Filas estructuradas (AI Commerce): solo las que tengan dato.
                Van primero; abajo siguen los specs legacy de WooCommerce y la
                garantía. Sin fallback a highlights: ya tienen su sección arriba. */}
            {specRows.map((item) => (
              <div key={item.label} className="grid grid-cols-[10rem_1fr] gap-3 py-2.5 text-sm">
                <dt className="font-semibold text-ink-500">{item.label}</dt>
                <dd className="text-ink-800">{item.value}</dd>
              </div>
            ))}
            {/* Sin fallback a highlights: ya tienen su sección arriba y
                repetirlos acá duplicaba el contenido en la misma página.
                Los specs vienen vacíos de WooCommerce; cuando el cliente
                mande specs reales, esta tabla los muestra. */}
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
      </div>

      <div className="mt-8 space-y-8">
        {product.highlights.length ? (
          <section className="card-surface p-6">
            <h2 className="mb-3 text-xl font-bold tracking-tight text-ink-900">Lo más destacado</h2>
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
          </section>
        ) : null}
        <section className="card-surface p-6">
          <h2 className="mb-3 text-xl font-bold tracking-tight text-ink-900">Descripción</h2>
          {product.descriptionHtml ? (
            // El HTML se sanea al guardarlo (migrador y panel) y otra vez acá,
            // por si quedó alguna fila guardada con una versión vieja del saneo.
            // `prose-soft`: el HTML migrado abusa de <strong> y de subtítulos
            // en cada línea; la referencia muestra el cuerpo en peso normal.
            // La jerarquía sobrevive por tamaño y espaciado, no por peso.
            <div
              className="prose-cd prose-soft"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.descriptionHtml) }}
            />
          ) : (
            <p className="text-sm leading-relaxed text-ink-600">
              {product.description || product.shortDescription}
            </p>
          )}
        </section>

        <section id="opiniones" className="card-surface space-y-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold tracking-tight text-ink-900">Opiniones de clientes</h2>
            <ReviewForm slug={product.slug} />
          </div>
          <RatingSummary rating={ratingStats.rating} count={ratingStats.count} distribution={ratingStats.distribution} />
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
                  <p className="mt-1.5 text-[11px] text-ink-500">
                    {review.author} · {formatDate(review.createdAt)}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      {related.length ? (
        <section className="mt-14">
          <h2 className="mb-5 text-xl font-extrabold tracking-tight text-ink-900">También te puede interesar</h2>
          {/* Carrusel a mano: no avanza solo. Flechas en escritorio, deslizar en el celular. */}
          <ProductRow products={related.map(toView)} label="las recomendaciones" />
        </section>
      ) : null}

      <section className="mt-14 grid gap-4 rounded-3xl bg-surface p-6 md:grid-cols-3">
        {[
          { icon: <Shield size={24} />, title: "Garantía oficial", text: `${product.warrantyMonths} meses cubiertos por el fabricante y gestionados por nosotros.` },
          { icon: <RefreshCw size={24} />, title: "Cambios sin drama", text: "Tenés 10 días corridos para cambiar el producto si no era lo que esperabas." },
          { icon: <MessageCircle size={24} />, title: "Asesoramiento real", text: "Preguntanos por WhatsApp antes de comprar: te respondemos en minutos." },
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

      <p className="mt-8 text-center text-xs text-ink-500">
        Precio de lista {money(product.compareAtPrice ?? product.price)} · Los precios pueden variar sin previo aviso según disponibilidad.
      </p>

      <MobileBuyBar product={buyBoxProduct} />
    </div>
  );
}
