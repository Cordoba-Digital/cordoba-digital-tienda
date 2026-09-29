"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

/**
 * Barra de categorías del escritorio: un ícono compacto con todo el catálogo y
 * las primeras raíces en texto, cada una con su panel de subcategorías al hover.
 *
 * Antes el acceso a todo el catálogo era el bloque naranja de "Categorías", que
 * se comía ~130 px de la barra y dejaba lugar para 6 de 21 raíces, dos de ellas
 * truncadas. Ese bloque es hoy un ícono de 36 px y las 21 raíces se siguen
 viendo en el panel del ícono; la barra sólo muestra las 6 primeras, que entran
 * enteras con el espacio liberado.
 *
 * Los paneles se abren por hover con 120 ms de gracia al cerrar: el puntero
 * tiene que atravesar el borde del disparador para llegar al panel y sin ese
 * margen se cerraría en el camino. El panel vive dentro del mismo `<li>` que el
 * disparador, así que seguirlo con el mouse nunca dispara un `mouseleave`.
 */

/** Nodo del árbol como lo pasa el layout: hijos con sus propios hijos. */
export type CategoryNavNode = {
  slug: string;
  name: string;
  icon: string;
  path: string;
  count?: number;
  children?: CategoryNavNode[];
};

export type CategoryNavRoot = CategoryNavNode & {
  tagline?: string;
};

/** Margen para cerrar: tiempo de cruzar del disparador al panel. */
const CLOSE_DELAY_MS = 120;
/** Llave del panel con todas las categorías (las de raíz son su slug). */
const ALL_KEY = "all-categories";
/** Raíces que entran en la barra. El resto vive en el panel del ícono. */
const BAR_LIMIT = 6;
/** Una columna angosta para las categorías chicas; el resto se reparte. */
const ONE_COLUMN_UP_TO = 6;
const TWO_COLUMNS_UP_TO = 12;
/**
 * Cuántos nietos se muestran bajo una subcategoría.
 *
 * Sin tope, "Notebooks" (10 nietos) estiraba una celda de la grilla a ~11
 * renglones y dejaba la columna de al lado con un hueco enorme. Con cuatro, las
 * columnas quedan parejas y el resto se sigue viendo entrando a la
 * subcategoría, que es donde están todos los productos.
 */
const NIETOS_EN_PANEL = 4;

/**
 * Columnas del panel según cuántas subcategorías tiene la raíz.
 *
 * Electrodomesticos tiene 19 hijos: en una sola columna el panel sería una
 * lista interminable de 19 renglones. Accesorios (6) y Audio y Video (5), en
 * cambio, entran cómodo en un panel angosto de una columna.
 */
function columnsFor(total: number): 1 | 2 | 3 {
  if (total <= ONE_COLUMN_UP_TO) return 1;
  if (total <= TWO_COLUMNS_UP_TO) return 2;
  return 3;
}

const PANEL_SHELL =
  "absolute left-0 top-full z-50 -mt-1.5 animate-pop rounded-2xl border border-ink-100 bg-surface p-3 shadow-2xl shadow-black/10";

/** Ancho del panel según cuántas subcategorías tiene la raíz. */
const PANEL_WIDTH: Record<1 | 2 | 3, string> = {
  1: "w-[17.5rem]",
  2: "w-[31rem]",
  3: "w-[43rem]",
};

/**
 * Las columnas van en la lista y no en el panel: multilínea de CSS reparte
 * *todos* los bloques hijos entre columnas, así que con las columnas en el
 * panel el pie "Ver toda la categoría" caía dentro de la segunda columna en vez
 * de abajo del todo.
 */
const PANEL_COLUMNS: Record<1 | 2 | 3, string> = {
  1: "columns-1",
  2: "columns-2 gap-x-5",
  3: "columns-3 gap-x-5",
};

/** Hijos de la raíz; los que tienen nietos los muestran indentados. */
function SubcategoryList({ nodes, columns }: { nodes: CategoryNavNode[]; columns: string }) {
  return (
    <ul className={`space-y-px ${columns}`}>
      {nodes.map((node) => (
        <li key={node.slug} className="break-inside-avoid">
          <Link
            href={`/categoria/${node.path}`}
            className="flex items-baseline gap-2 rounded-lg px-2 py-1 text-[13px] leading-snug text-ink-600 transition hover:bg-ink-50 hover:text-ink-900"
          >
            <span className="min-w-0 flex-1">{node.name}</span>
            {typeof node.count === "number" && node.count > 0 ? (
              <span className="shrink-0 text-[11px] tabular-nums text-ink-300">{node.count}</span>
            ) : null}
          </Link>
          {node.children?.length ? (
            <ul className="mb-1 ml-2.5 mt-0.5 space-y-px border-l border-ink-100 pl-2">
              {node.children.slice(0, NIETOS_EN_PANEL).map((grand) => (
                <li key={grand.slug} className="break-inside-avoid">
                  <Link
                    href={`/categoria/${grand.path}`}
                    className="flex items-baseline gap-2 rounded px-2 py-0.5 text-[11.5px] leading-snug text-ink-400 transition hover:bg-ink-50 hover:text-brand-700"
                  >
                    <span className="min-w-0 flex-1">{grand.name}</span>
                    {typeof grand.count === "number" && grand.count > 0 ? (
                      <span className="shrink-0 text-[10.5px] tabular-nums text-ink-300">
                        {grand.count}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
              {node.children.length > NIETOS_EN_PANEL ? (
                <li>
                  <Link
                    href={`/categoria/${node.path}`}
                    className="block rounded px-2 py-0.5 text-[11px] font-semibold text-brand-600 transition hover:text-brand-700"
                  >
                    +{node.children.length - NIETOS_EN_PANEL} más
                  </Link>
                </li>
              ) : null}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Pie común: la salida del panel es la página de la categoría. */
function PanelFooter({ path, name }: { path: string; name: string }) {
  return (
    <Link
      href={`/categoria/${path}`}
      className="mt-2 block rounded-lg bg-ink-50 px-3 py-2 text-center text-[12px] font-bold text-brand-700 transition hover:bg-brand-50 hover:text-brand-800"
    >
      Ver toda la categoría
      <span className="sr-only"> {name}</span> →
    </Link>
  );
}

/** Panel de una raíz con subcategorías. */
function RootPanel({
  root,
  panelId,
  triggerId,
}: {
  root: CategoryNavRoot;
  panelId: string;
  triggerId: string;
}) {
  const kids = root.children ?? [];
  const columns = columnsFor(kids.length);
  return (
    <div
      id={panelId}
      role="group"
      aria-labelledby={triggerId}
      className={`${PANEL_SHELL} max-h-[70vh] overflow-y-auto ${PANEL_WIDTH[columns]}`}
    >
      <SubcategoryList nodes={kids} columns={PANEL_COLUMNS[columns]} />
      <PanelFooter path={root.path} name={root.name} />
    </div>
  );
}

/** Panel del ícono compacto: las 21 raíces, con sus hijos y nietos. */
function AllCategoriesPanel({
  categories,
  panelId,
  triggerId,
}: {
  categories: CategoryNavRoot[];
  panelId: string;
  triggerId: string;
}) {
  return (
    <div
      id={panelId}
      role="group"
      aria-labelledby={triggerId}
      className={`${PANEL_SHELL} max-h-[70vh] w-[min(66rem,calc(100vw_-_3rem))] overflow-y-auto p-4`}
    >
      <div className="columns-2 gap-x-5 lg:columns-3 2xl:columns-4">
        {categories.map((root) => (
          <div key={root.slug} className="mb-3 break-inside-avoid">
            <Link
              href={`/categoria/${root.path}`}
              className="flex items-center gap-2 rounded-lg px-2 py-1 transition hover:bg-ink-50"
            >
              <span className="text-base leading-none" aria-hidden>
                {root.icon}
              </span>
              <span className="min-w-0 flex-1 text-[13px] font-bold text-ink-800">{root.name}</span>
              {typeof root.count === "number" && root.count > 0 ? (
                <span className="shrink-0 text-[11px] tabular-nums text-ink-300">{root.count}</span>
              ) : null}
            </Link>
            {root.children?.length ? <SubcategoryList nodes={root.children} columns="columns-1" /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CategoryNavBar({ categories }: { categories: CategoryNavRoot[] }) {
  const pathname = usePathname();
  const baseId = useId();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const closeTimer = useRef<number | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const closeSoon = useCallback(() => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      setOpenKey(null);
    }, CLOSE_DELAY_MS);
  }, [cancelClose]);

  const openPanel = useCallback(
    (key: string) => {
      cancelClose();
      setOpenKey(key);
    },
    [cancelClose],
  );

  // El timer vive en un ref: si se desmonta la barra con uno pendiente, no
  // queda un `setState` sobre un componente que ya no existe.
  useEffect(() => cancelClose, [cancelClose]);

  // Navegar es una salida del panel, aunque la ruta no cambie (misma categoría).
  // El reset va en el render y no en un efecto: un `setState` dentro del efecto
  // encadenaría un render extra en cada navegación.
  const [route, setRoute] = useState(pathname);
  if (route !== pathname) {
    setRoute(pathname);
    setOpenKey(null);
  }

  useEffect(() => {
    cancelClose();
  }, [pathname, cancelClose]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(event.target as Node)) setOpenKey(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Escape cierra y devuelve el foco al disparador del panel abierto.
  useEffect(() => {
    if (openKey === null) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenKey(null);
      barRef.current
        ?.querySelector<HTMLElement>(`[data-nav-trigger="${openKey}"]`)
        ?.focus();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [openKey]);

  /** Tabular fuera del disparador y de su panel cierra; dentro, no. */
  const handleBlur = (event: React.FocusEvent<HTMLLIElement>) => {
    const next = event.relatedTarget as Node | null;
    if (!next || !event.currentTarget.contains(next)) closeSoon();
  };

  const visible = categories.slice(0, BAR_LIMIT);

  return (
    <div className="hidden border-t border-ink-100 lg:block">
      <div ref={barRef} className="container-xl flex h-11 items-stretch gap-2">
        <ul className="flex min-w-0 flex-1 items-stretch gap-0.5">
          {/*
            El ícono abre el catálogo completo y además se puede usar con teclado
            (Enter abre y Escape cierra), así que no depende del puntero.
          */}
          <li
            className="relative flex shrink-0 items-center"
            onMouseEnter={() => openPanel(ALL_KEY)}
            onMouseLeave={closeSoon}
            onBlur={handleBlur}
          >
            <button
              type="button"
              data-nav-trigger={ALL_KEY}
              id={`${baseId}-all-trigger`}
              aria-expanded={openKey === ALL_KEY}
              aria-controls={`${baseId}-all-panel`}
              aria-haspopup="true"
              onClick={() => (openKey === ALL_KEY ? closeSoon() : openPanel(ALL_KEY))}
              aria-label="Ver todas las categorías"
              title="Ver todas las categorías"
              className="grid h-9 w-9 place-items-center rounded-lg text-ink-600 transition hover:bg-ink-100 hover:text-ink-900 aria-expanded:bg-ink-100 aria-expanded:text-ink-900"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
              </svg>
            </button>
            {openKey === ALL_KEY ? (
              <AllCategoriesPanel
                categories={categories}
                panelId={`${baseId}-all-panel`}
                triggerId={`${baseId}-all-trigger`}
              />
            ) : null}
          </li>

          {visible.map((root) => {
            const hasKids = Boolean(root.children?.length);
            const isOpen = openKey === root.slug;
            const triggerId = `${baseId}-${root.slug}-trigger`;
            return (
              <li
                key={root.slug}
                className="relative flex min-w-0 items-center"
                onMouseEnter={hasKids ? () => openPanel(root.slug) : undefined}
                onMouseLeave={hasKids ? closeSoon : undefined}
                onBlur={hasKids ? handleBlur : undefined}
              >
                {/*
                  Nombre entero, sin truncar: los 6 suman ~750 px y el más largo,
                  "Accesorios P/ Celulares", necesita 152 px. Con el padding que
                  tenía antes el sexto nombre se pisaba con "Ofertas" a 1024 px.
                */}
                <Link
                  href={`/categoria/${root.path}`}
                  data-nav-trigger={root.slug}
                  id={triggerId}
                  onFocus={hasKids ? () => openPanel(root.slug) : undefined}
                  aria-expanded={hasKids ? isOpen : undefined}
                  aria-haspopup={hasKids ? true : undefined}
                  aria-controls={hasKids ? `${baseId}-${root.slug}-panel` : undefined}
                  className={`flex min-w-0 items-center whitespace-nowrap rounded-lg px-2 py-1.5 text-[13px] font-medium transition hover:bg-ink-50 hover:text-ink-900 ${
                    isOpen ? "bg-ink-50 text-ink-900" : "text-ink-600"
                  }`}
                >
                  {root.name}
                </Link>
                {hasKids && isOpen ? (
                  <RootPanel
                    root={root}
                    panelId={`${baseId}-${root.slug}-panel`}
                    triggerId={triggerId}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>

        <div className="flex shrink-0 items-center gap-0.5">
          <Link
            href="/productos?ofertas=1"
            className="whitespace-nowrap rounded-lg px-2 py-1.5 text-[13px] font-bold text-rose-600 transition hover:bg-rose-50"
          >
            🔥 Ofertas
          </Link>
          <Link
            href="/ayuda"
            className="whitespace-nowrap rounded-lg px-2 py-1.5 text-[13px] font-medium text-ink-600 transition hover:bg-ink-50"
          >
            Ayuda
          </Link>
        </div>
      </div>
    </div>
  );
}
