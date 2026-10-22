import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getGuideBySlug, getGuides } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { url } from "@/lib/site";
import { breadcrumbJsonLd, jsonLdString, ORG_ID } from "@/lib/structured-data";

export const dynamic = "force-dynamic";

/** Letras y números de un texto o HTML: para comparar sin etiquetas, entidades ni puntuación. */
function soloLetras(texto: string): string {
  return texto
    .replace(/<[^>]+>|&#?\w+;/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toLowerCase();
}

/**
 * Guías de compra.
 *
 * La ruta es un segmento dinámico en la RAÍZ, no `/guias/[slug]`, a propósito:
 * en el sitio original los artículos viven en la raíz
 * (`/como-elegir-tu-proxima-impresora/`) y ese es el direccionamiento que Google
 * ya tiene indexado. Si los moviéramos, el trabajo SEO previo se pierde.
 *
 * Next da prioridad a los segmentos estáticos, así que esta ruta solo captura
 * lo que no sea `/productos`, `/carrito`, `/ayuda` y compañía. Y como además
 * devuelve 404 si el slug no está en la base, no puede secuestrar ninguna
 * dirección.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ guia: string }>;
}): Promise<Metadata> {
  const { guia } = await params;
  const article = await getGuideBySlug(guia);
  if (!article) return { title: "Guía no encontrada", robots: { index: false } };

  const titulo = article.subtitle
    ? `${article.title} · ${article.subtitle}`
    : article.title;

  return {
    title: article.title,
    description: article.description.slice(0, 160),
    alternates: { canonical: `/${article.slug}` },
    openGraph: {
      type: "article",
      locale: "es_AR",
      url: `/${article.slug}`,
      siteName: "Córdoba Digital",
      title: article.title,
      description: article.description.slice(0, 160),
      publishedTime: article.publishedAt.toISOString(),
      modifiedTime: article.updatedAt.toISOString(),
    },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ guia: string }> }) {
  const { guia } = await params;
  // Artículo y lista de guías en paralelo: el filtro de "otras" solo necesita
  // el slug, no el artículo resuelto.
  const [article, todas] = await Promise.all([getGuideBySlug(guia), getGuides()]);
  if (!article) notFound();

  const meta = article.meta ?? {};
  const otras = todas.filter((g) => g.slug !== article.slug);
  // Con las notas del blog son más de 40: se sugieren las primeras (las del
  // pie y después las más nuevas) y el resto queda en el índice.
  const sugeridas = otras.slice(0, 6);
  // Las notas del blog no traen un resumen escrito: el suyo es el comienzo
  // del artículo, y mostrarlo arriba repetiría las mismas frases.
  const resumenRepetido = soloLetras(article.body).startsWith(soloLetras(article.description).slice(0, 40));

  return (
    <article className="container-xl py-8">
      {/* Artículo + miga: con autor/editor y fechas, que es lo que Google y los
          buscadores de IA miran para decidir si una guía es confiable y vigente. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString([
            {
              "@context": "https://schema.org",
              "@type": "Article",
              headline: article.title,
              description: article.description,
              url: url(`/${article.slug}`),
              mainEntityOfPage: url(`/${article.slug}`),
              inLanguage: "es-AR",
              datePublished: article.publishedAt.toISOString(),
              dateModified: article.updatedAt.toISOString(),
              author: { "@id": ORG_ID },
              publisher: { "@id": ORG_ID },
            },
            breadcrumbJsonLd([
              { name: "Inicio", path: "/" },
              { name: "Guías de compra", path: "/guias" },
              { name: article.title },
            ]),
          ]),
        }}
      />
      <nav aria-label="Miga de pan" className="mb-6 text-xs text-ink-500">
        <Link href="/" className="transition hover:text-brand-700">
          Inicio
        </Link>
        <span className="mx-1.5">/</span>
        <Link href="/guias" className="transition hover:text-brand-700">
          Guías de compra
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-ink-600">{article.title}</span>
      </nav>

      <header className="mb-8 max-w-3xl">
        {meta.etiqueta ? (
          <p className="mb-3 inline-block rounded-full bg-brand-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-brand-700">
            {meta.etiqueta}
          </p>
        ) : null}

        <h1 className="text-3xl font-black tracking-tight text-ink-900 md:text-4xl">{article.title}</h1>

        {article.subtitle ? (
          <p className="mt-3 text-base font-semibold leading-snug text-ink-600">{article.subtitle}</p>
        ) : null}

        {article.description && !resumenRepetido ? (
          <p className="mt-3 text-sm leading-relaxed text-ink-500">{article.description}</p>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-500">
          <span>Actualizado el {formatDate(article.updatedAt)}</span>
          {meta.actualizacion ? <span>· {meta.actualizacion}</span> : null}
          {meta.cobertura ? <span>· Cobertura: {meta.cobertura}</span> : null}
        </div>

        {meta.categoria ? (
          <Link
            href={meta.categoria}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-800"
          >
            Ver productos de esta categoría →
          </Link>
        ) : null}
      </header>

      {/*
        El HTML viene de `scripts/lib/guia-html.mjs`, que lo reduce a una lista
        blanca de etiquetas y le saca todos los atributos salvo `href`. Es el
        único motivo por el que este `dangerouslySetInnerHTML` es aceptable: no
        hay forma de que llegue un `<script>`, un `onclick` o un `style`.
        Ver `npm test` (tests/unit/guia-html.test.mts).
      */}
      <div className="prose-cd max-w-3xl" dangerouslySetInnerHTML={{ __html: article.body }} />

      {otras.length ? (
        <aside className="mt-14 max-w-3xl border-t border-ink-100 pt-8">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-lg font-extrabold text-ink-900">Otras guías de compra</h2>
            <Link href="/guias" className="text-xs font-bold text-brand-700 transition hover:text-brand-600">
              Ver las {otras.length + 1} →
            </Link>
          </div>
          <ul className="mt-4 space-y-2.5">
            {sugeridas.map((otra) => (
              <li key={otra.slug}>
                <Link
                  href={`/${otra.slug}`}
                  className="text-sm font-semibold text-brand-700 transition hover:text-brand-600"
                >
                  {otra.title}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
    </article>
  );
}
