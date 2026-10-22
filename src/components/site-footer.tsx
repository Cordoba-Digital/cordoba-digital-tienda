import Link from "next/link";

import { getGuides, type GuideTeaser } from "@/lib/queries";

const CATEGORY_LINKS: { name: string; path: string; count: number }[] = [];

/**
 * Guías de compra del pie.
 *
 * En el sitio original esta columna existe y enlaza cinco artículos de blog. Las
 * guías viven en la base (tabla `guides`, migradas con `npm run migrar:guias`) y
 * conservan el slug del sitio viejo, así que la URL es la misma. Las demás
 * notas del blog viven en la misma tabla con `footerOrder` 0 y no van acá: se
 * llega a ellas desde `/guias`.
 *
 * Si la base no responde, el pie se dibuja sin la columna en vez de romperse:
 * el pie está en todas las páginas y no puede depender de la base.
 */
export async function SiteFooter({
  categories = CATEGORY_LINKS,
  cuit = "",
  guides = [],
  usdt = false,
}: {
  categories?: { name: string; path: string; count: number }[];
  /** CUIT real del cliente. Si viene vacío no se imprime ninguno. */
  cuit?: string;
  guides?: GuideTeaser[];
  /** Hay wallet y cotización USDT cargadas en el panel: se ofrece en el checkout. */
  usdt?: boolean;
}) {
  const delPie = guides.filter((guide) => guide.footerOrder > 0);
  return (
    <footer className="mt-20 mesh-warm border-t border-brand-100 text-ink-600">
      <div className="container-xl grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <div>
          {/* El logo tiene fondo blanco propio: va en una tarjeta blanca con
              aire alrededor, sin el borde naranja que lo hacía ver recortado
              sobre el degradé, y sin repetir el nombre que el logo ya dice. */}
          <div className="mb-5 inline-flex rounded-xl bg-white px-4 py-3 shadow-[0_8px_24px_-16px_rgba(20,22,28,0.35)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo.png" alt="Córdoba Digital" width={1461} height={1005} className="h-12 w-auto object-contain" />
          </div>
          <p className="text-sm leading-relaxed text-ink-600">
            Tecnología con garantía legal. Local a la calle en el centro de Córdoba y envíos a todo el país con
            seguimiento.
          </p>
          <div className="mt-6 space-y-1.5 text-sm text-ink-600">
            <p className="font-semibold text-ink-900">Local: 27 de Abril 180, Córdoba</p>
            {/* Un renglón por día: en una sola línea el sábado quedaba partido. */}
            <p>Lunes a viernes de 14:00 a 18:30</p>
            <p>Sábados de 12:00 a 14:30</p>
            <a href="tel:+543516777774" className="block transition hover:text-brand-700">
              +54 351 677-7774
            </a>
            <a href="mailto:consultas@cordobadigital.net" className="block transition hover:text-brand-700">
              consultas@cordobadigital.net
            </a>
          </div>

          <div className="mt-5 flex gap-2">
            <a
              href="https://instagram.com/cordobadigital.ok"
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
              className="grid h-9 w-9 place-items-center rounded-lg border border-brand-100 bg-white text-ink-700 transition hover:border-brand-300 hover:text-brand-700"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.06 1.17-.26 1.8-.42 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.06-1.8-.26-2.23-.42-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.06-1.17.26-1.8.42-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41 1.27-.06 1.65-.07 4.85-.07M12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.31-1.46.72-2.13 1.38S.94 3.35.63 4.14C.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.28.26 2.15.56 2.91.31.79.72 1.46 1.38 2.13.67.67 1.34 1.08 2.13 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.28-.06 2.15-.26 2.91-.56.79-.31 1.46-.72 2.13-1.38.67-.67 1.08-1.34 1.38-2.13.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.28-.26-2.15-.56-2.91-.31-.79-.72-1.46-1.38-2.13S20.65.94 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0zm0 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84zM12 16a4 4 0 1 1 4-4 4 4 0 0 1-4 4zm7.85-10.4a1.44 1.44 0 1 1-1.44-1.44 1.44 1.44 0 0 1 1.44 1.44z" />
              </svg>
            </a>
            <a
              href="https://facebook.com/cbadigital"
              target="_blank"
              rel="noreferrer"
              aria-label="Facebook"
              className="grid h-9 w-9 place-items-center rounded-lg border border-brand-100 bg-white text-ink-700 transition hover:border-brand-300 hover:text-brand-700"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M13.5 21.5v-7.2h2.42l.36-2.8H13.5V9.7c0-.81.23-1.36 1.39-1.36h1.49V5.83c-.26-.03-1.14-.11-2.16-.11-2.14 0-3.61 1.3-3.61 3.7v2.08H8.18v2.8h2.43v7.2h2.89z" />
              </svg>
            </a>
            <a
              href="https://wa.me/5493516777774"
              target="_blank"
              rel="noreferrer"
              aria-label="WhatsApp"
              className="grid h-9 w-9 place-items-center rounded-lg border border-brand-100 bg-white text-ink-700 transition hover:border-brand-300 hover:text-brand-700"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12.04 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.9 11.9 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.9 0-3.18-1.24-6.16-3.48-8.41A11.82 11.82 0 0 0 12.04 0zm0 21.79h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.9-9.88a9.83 9.83 0 0 1 9.88 9.89c0 5.45-4.44 9.88-9.89 9.88zm5.16-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.5 0 1.47 1.07 2.9 1.22 3.1.15.2 2.1 3.2 5.1 4.49.71.31 1.27.49 1.7.63.72.23 1.37.2 1.88.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35z" />
              </svg>
            </a>
          </div>

        </div>

        <div>
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-ink-900">Categorías</h3>
          <ul className="space-y-2.5 text-sm">
            {categories.slice(0, 8).map((c) => (
              <li key={c.path}>
                <Link href={`/categoria/${c.path}`} className="text-ink-600 transition hover:text-brand-700">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-ink-900">Tu compra</h3>
          <ul className="space-y-2.5 text-sm">
            <li>
              <Link href="/seguimiento" className="text-ink-600 transition hover:text-brand-700">
                Seguir mi pedido
              </Link>
            </li>
            <li>
              <Link href="/ayuda" className="text-ink-600 transition hover:text-brand-700">
                Envíos y plazos de entrega
              </Link>
            </li>
            <li>
              <Link href="/politica-de-garantia" className="text-ink-600 transition hover:text-brand-700">
                Garantía y post-venta
              </Link>
            </li>
            <li>
              <Link href="/cambio-devoluciones" className="text-ink-600 transition hover:text-brand-700">
                Cambios y devoluciones
              </Link>
            </li>
            <li>
              <Link href="/ayuda#pagos" className="text-ink-600 transition hover:text-brand-700">
                Medios de pago
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-ink-900">INFORMACIÓN</h3>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/quienes-somos" className="text-ink-600 transition hover:text-brand-700">¿Quiénes Somos?</Link></li>
            <li><Link href="/por-que-elegirnos" className="text-ink-600 transition hover:text-brand-700">¿Por qué elegirnos?</Link></li>
            <li><Link href="/politica-de-garantia" className="text-ink-600 transition hover:text-brand-700">Política de Garantía</Link></li>
            <li><Link href="/cambio-devoluciones" className="text-ink-600 transition hover:text-brand-700">Cambios y Devoluciones</Link></li>
            <li><Link href="/politica-privacidad" className="text-ink-600 transition hover:text-brand-700">Políticas de Privacidad</Link></li>
            <li><Link href="/arrepentimiento" className="text-ink-600 transition hover:text-brand-700">Botón de Arrepentimiento</Link></li>
          </ul>
        </div>

        {delPie.length ? (
          <div>
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-ink-900">
              {/* El título de la columna abre el índice, que no existe en el sitio
                  original: allá las guías solo se llegan por estos enlaces. */}
              <Link href="/guias" className="transition hover:text-brand-700">
                Guía de compras
              </Link>
            </h3>
            <ul className="space-y-2.5 text-sm">
              {delPie.map((guide) => (
                <li key={guide.slug}>
                  <Link href={`/${guide.slug}`} className="text-ink-600 transition hover:text-brand-700">
                    {guide.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="border-t border-brand-100">
        <div className="container-xl flex flex-col items-center justify-between gap-4 py-6 text-xs text-ink-500 md:flex-row">
          <p>
            © {new Date().getFullYear()} Córdoba Digital
            {cuit ? ` · CUIT ${cuit}` : ""} · Todos los derechos reservados.
          </p>
          {/* Sin procesador de tarjetas: solo los medios que de verdad se aceptan. */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {[
              "Transferencia desde cualquier banco o billetera virtual",
              ...(usdt ? ["USDT (red TRON)"] : []),
              "Efectivo en el local",
            ].map((m) => (
              <span key={m} className="rounded-md border border-brand-100 bg-white px-2.5 py-1 text-[11px] font-semibold text-ink-600">
                {m}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
