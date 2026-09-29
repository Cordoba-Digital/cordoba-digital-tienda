import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getGuideBySlug, getGuides } from "@/lib/queries";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const BASE = "https://www.cordobadigital.net";

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
    alternates: { canonical: `${BASE}/${article.slug}` },
    openGraph: {
      type: "article",
      locale: "es_AR",
      url: `${BASE}/${article.slug}`,
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
  const article = await getGuideBySlug(guia);
  if (!article) notFound();

  const meta = article.meta ?? {};
  const otras = (await getGuides()).filter((g) => g.slug !== article.slug);

  return (
    <article className="container-xl py-8">
      <nav aria-label="Miga de pan" className="mb-6 text-xs text-ink-400">
        <Link href="/" className="transition hover:text-brand-700">
          Inicio
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-ink-600">Guías de compra</span>
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

        {article.description ? (
          <p className="mt-3 text-sm leading-relaxed text-ink-500">{article.description}</p>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-400">
          <span>Actualizado el {formatDate(article.updatedAt)}</span>
          {meta.actualizacion ? <span>· {meta.actualizacion}</span> : null}
          {meta.cobertura ? <span>· Cobertura: {meta.cobertura}</span> : null}
        </div>

        {meta.categoria ? (
          <Link
            href={meta.categoria}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-700"
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
        Ver `npm run test:guias`.
      */}
      <div className="prose-cd max-w-3xl" dangerouslySetInnerHTML={{ __html: article.body }} />

      {otras.length ? (
        <aside className="mt-14 max-w-3xl border-t border-ink-100 pt-8">
          <h2 className="text-lg font-extrabold text-ink-900">Otras guías de compra</h2>
          <ul className="mt-4 space-y-2.5">
            {otras.map((otra) => (
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
