import Link from "next/link";

import { CategoryIcon, Icon } from "@/components/category-icon";
import { pageWindow } from "@/lib/page-window";

/** Paginación compartida por /productos y /categoria/*. */
export function Pagination({
  page,
  pages,
  hrefFor,
}: {
  page: number;
  pages: number;
  hrefFor: (page: number) => string;
}) {
  if (pages <= 1) return null;
  const base =
    "grid h-10 min-w-10 place-items-center rounded-xl border px-3 text-sm font-bold transition";
  const idle = "border-ink-200 bg-surface text-ink-700 hover:border-brand-300 hover:text-brand-700";
  return (
    <nav aria-label="Paginación" className="mt-10 flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} rel="prev" aria-label="Página anterior" className={`${base} ${idle}`}>
          <Icon name="chevronLeft" className="h-4 w-4" />
        </Link>
      ) : null}
      {/* Ventana de 5 alrededor de la actual con "…" a los lados: con 2.588
          productos son 108 páginas y listarlas todas desbordaba la fila. */}
      {pageWindow(page, pages).map((p, i) =>
        p === "gap" ? (
          <span key={`gap-${i}`} className="px-1 text-sm font-bold text-ink-500">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={hrefFor(p as number)}
            aria-current={p === page ? "page" : undefined}
            className={`${base} ${p === page ? "border-brand-700 bg-brand-700 text-white" : idle}`}
          >
            {p}
          </Link>
        ),
      )}
      {page < pages ? (
        <Link href={hrefFor(page + 1)} rel="next" aria-label="Página siguiente" className={`${base} ${idle}`}>
          <Icon name="chevronRight" className="h-4 w-4" />
        </Link>
      ) : null}
    </nav>
  );
}

/** Sin resultados: SVG en vez de emoji y dos salidas claras. */
export function EmptyResults({ resetHref, resetLabel }: { resetHref: string; resetLabel: string }) {
  return (
    <div className="card-surface flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand-700">
        <Icon name="search" className="h-8 w-8" />
      </span>
      <h2 className="text-lg font-bold text-ink-900">No encontramos productos con esos filtros</h2>
      <p className="max-w-md text-sm text-ink-500">
        Probá quitando algún filtro o escribinos por WhatsApp: conseguimos más del 90% de los productos del mercado
        aunque no estén publicados.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Link href={resetHref} className="rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-800">
          {resetLabel}
        </Link>
        <a
          href="https://wa.me/5493516777774"
          target="_blank"
          rel="noreferrer"
          className="rounded-xl border border-ink-200 px-5 py-2.5 text-sm font-bold text-ink-700 hover:border-emerald-300 hover:text-emerald-700"
        >
          Pedir cotización
        </a>
      </div>
    </div>
  );
}

/** Fila de categorías raíz con scroll horizontal: la entrada al catálogo en móvil. */
export function CategoryChips({
  items,
  activePath,
}: {
  items: { slug: string; name: string; path: string; count?: number }[];
  activePath?: string;
}) {
  return (
    <nav aria-label="Categorías" className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0 lg:hidden">
      {items.map((c) => (
        <Link
          key={c.slug}
          href={`/categoria/${c.path}`}
          className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold transition ${
            activePath === c.path
              ? "border-brand-700 bg-brand-700 text-white"
              : "border-ink-200 bg-surface text-ink-700 hover:border-brand-300 hover:text-brand-700"
          }`}
        >
          <CategoryIcon name={c.name} className="h-4 w-4" />
          {c.name}
        </Link>
      ))}
    </nav>
  );
}
