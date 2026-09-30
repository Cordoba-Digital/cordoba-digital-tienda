import type { Metadata } from "next";
import Link from "next/link";

import { formatDate } from "@/lib/format";
import { getGuideCards } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Guías de compra",
  description:
    "Qué mirar antes de comprar tu próxima impresora, celular Xiaomi, notebook, MacBook o monopatín eléctrico en Argentina: diferencias entre opciones y qué conviene descartar.",
  alternates: { canonical: "https://www.cordobadigital.net/guias" },
};

/**
 * Palabras por minuto de una persona leyendo en pantalla.
 *
 * Solo se usa para el "X min de lectura" de la tarjeta. No es un dato del sitio
 * original ni una promesa: sale de la cantidad de palabras de cada artículo, que
 * sí es real.
 */
const PALABRAS_POR_MINUTO = 220;

function minutosDeLectura(palabras: number): number {
  return Math.max(1, Math.round(palabras / PALABRAS_POR_MINUTO));
}

export default async function GuidesIndexPage() {
  const guias = await getGuideCards();

  return (
    <div className="container-xl py-10">
      <nav aria-label="Miga de pan" className="mb-6 text-xs text-ink-500">
        <Link href="/" className="transition hover:text-brand-700">
          Inicio
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-ink-600">Guías de compra</span>
      </nav>

      <header className="max-w-3xl">
        <h1 className="text-3xl font-black tracking-tight text-ink-900 md:text-4xl">Guías de compra</h1>
        {/*
          OJO con esta descripción: se chequea contra el contenido real de los
          artículos con `npm run verificar:claims-guias`. La versión anterior
          decía "con los precios y la disponibilidad de Córdoba" y era falsa:
          solo una de las cinco guías cita precios en pesos, y ninguna trae una
          lista de disponibilidad. Lo que sí es cierto es que las cinco hablan
          del mercado argentino y de qué mirar antes de comprar.
        */}
        <p className="mt-3 text-base leading-relaxed text-ink-600">
          Qué mirar antes de comprar tu próximo equipo en Argentina: en qué se diferencian las opciones, cuáles conviene
          para cada uso y qué conviene descartar. Guías escritas para Córdoba Digital, con el mercado argentino a la
          vista.
        </p>
        <p className="mt-2 text-sm text-ink-500">{guias.length} guías</p>
      </header>

      {guias.length === 0 ? (
        <p className="mt-10 text-sm text-ink-500">
          Todavía no hay guías publicadas. Volvé en un rato.
        </p>
      ) : (
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {guias.map((guia) => (
            <article key={guia.slug} className="card-surface flex flex-col p-6">
              {guia.meta?.etiqueta ? (
                <p className="mb-3 inline-block self-start rounded-full bg-brand-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-brand-700">
                  {guia.meta.etiqueta}
                </p>
              ) : null}

              <h2 className="text-lg font-extrabold leading-snug text-ink-900">
                <Link href={`/${guia.slug}`} className="transition hover:text-brand-700">
                  {guia.title}
                </Link>
              </h2>

              {guia.subtitle ? (
                <p className="mt-1.5 text-sm font-semibold leading-snug text-ink-600">{guia.subtitle}</p>
              ) : null}

              {guia.description ? (
                <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-ink-500">{guia.description}</p>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
                <span>Actualizada el {formatDate(guia.updatedAt)}</span>
                <span>· {minutosDeLectura(guia.wordCount)} min de lectura</span>
                {guia.wordCount > 0 ? <span>· {guia.wordCount.toLocaleString("es-AR")} palabras</span> : null}
              </div>

              <div className="mt-auto pt-5">
                <Link
                  href={`/${guia.slug}`}
                  className="text-sm font-bold text-brand-700 transition hover:text-brand-600"
                >
                  Leer la guía →
                </Link>
                {guia.meta?.categoria ? (
                  <>
                    <span className="mx-2 text-ink-500">·</span>
                    <Link
                      href={guia.meta.categoria}
                      className="text-sm font-semibold text-ink-600 transition hover:text-brand-700"
                    >
                      Ver productos
                    </Link>
                  </>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
