"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useStore } from "@/components/store-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { money } from "@/lib/format";

/** Nodo del árbol de categorías, con dos niveles de descendencia. */
type CategoryNode = {
  slug: string;
  name: string;
  icon: string;
  path: string;
  count?: number;
  children?: CategoryNode[];
};

type CategoryLink = CategoryNode & { tagline: string };

/** Cuántas categorías raíz van en la barra, en el orden en que las elige el cliente. */
const CATEGORIAS_EN_BARRA = 6;

/**
 * Por encima de este número de subcategorías el panel se parte en dos columnas.
 * Hay dos que lo necesitan de verdad: Computación tiene 20 hijos y 13 nietos, y
 * Electrodomésticos 19. En una sola columna el panel mediría casi un metro.
 */
const COLUMNAS_PANEL = 8;

/**
 * Cuántos nietos se muestran bajo una subcategoría.
 *
 * Sin tope, "Notebooks" (10 nietos) estiraba una celda de la grilla a ~11 renglones
 * y dejaba la columna de al lado con un hueco enorme. Con cuatro, las dos
 * columnas quedan parejas y el resto se sigue viendo entrando a la
 * subcategoría, que es donde están todos los productos.
 */
const NIETOS_EN_PANEL = 4;

type Suggestion = {
  slug: string;
  name: string;
  brand: string;
  price: number;
  image: string | null;
  categorySlug: string;
};

const ANNOUNCEMENTS = [
  "🔥 15% OFF pagando con transferencia o USDT",
  "🚚 Envío gratis a todo el país en compras desde $250.000",
  "💳 Hasta 6 cuotas sin interés con todas las tarjetas",
  "🏬 Retiro en 2 hs en 27 de Abril 259, Córdoba Capital",
  "🛡ï¸ 12 meses de garantía oficial + soporte post-venta local",
];

/**
 * Panel de subcategorías que se abre al pasar el mouse por una categoría de la
 * barra.
 *
 * El ancho se decide por la cantidad de subcategorías y no es un valor fijo:
 * con 6 columnas angostas el panel de Accesorios queda desproporcionado, y con
 * dos angostas el de Computación (20 hijos) se vuelve una torre. Arriba de
 * `COLUMNAS_PANEL` se parte en dos.
 */
function PanelCategoria({ categoria }: { categoria: CategoryNode }) {
  const hijos = categoria.children ?? [];
  if (hijos.length === 0) return null;

  const dosColumnas = hijos.length > COLUMNAS_PANEL;

  return (
    // No hace falta `onMouseEnter` acá: el `onMouseLeave` de la barra solo se
    // dispara al salir del conjunto, así que pasar del link al panel no lo cierra.
    <div
      className={`absolute left-0 top-full z-50 animate-pop overflow-hidden rounded-2xl border border-ink-100 bg-surface shadow-2xl shadow-black/10 ${
        dosColumnas ? "w-[620px]" : "w-[280px]"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3 border-b border-ink-100 px-4 py-2.5">
        <span className="flex items-center gap-2 text-sm font-bold text-ink-900">
          <span aria-hidden>{categoria.icon}</span>
          {categoria.name}
        </span>
        {typeof categoria.count === "number" ? (
          <span className="text-[11px] text-ink-400">{categoria.count} productos</span>
        ) : null}
      </div>

      <div className={`max-h-[60vh] overflow-y-auto p-2 ${dosColumnas ? "grid grid-cols-2 gap-x-1" : ""}`}>
        {hijos.map((hijo) => (
          <div key={hijo.slug}>
            <Link
              href={`/categoria/${hijo.path}`}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-ink-700 transition hover:bg-brand-50 hover:text-brand-700"
            >
              <span aria-hidden>{hijo.icon}</span>
              <span className="min-w-0 flex-1 truncate">{hijo.name}</span>
              {typeof hijo.count === "number" ? (
                <span className="shrink-0 text-[11px] tabular-nums text-ink-300">{hijo.count}</span>
              ) : null}
            </Link>
            {/* Los nietos solo existen bajo 4 raíces, así que la lista anidada
                casi nunca se ve. Cuando aparece, va con sangría y acotada. */}
            {hijo.children?.length ? (
              <ul className="mb-1 ml-4 space-y-0.5 border-l border-ink-100 pl-2">
                {hijo.children.slice(0, NIETOS_EN_PANEL).map((nieto) => (
                  <li key={nieto.slug}>
                    <Link
                      href={`/categoria/${nieto.path}`}
                      className="block truncate rounded px-2 py-1 text-[12px] text-ink-500 transition hover:text-brand-700"
                    >
                      {nieto.name}
                    </Link>
                  </li>
                ))}
                {hijo.children.length > NIETOS_EN_PANEL ? (
                  <li>
                    <Link
                      href={`/categoria/${hijo.path}`}
                      className="block rounded px-2 py-1 text-[11px] font-semibold text-brand-600 transition hover:text-brand-700"
                    >
                      +{hijo.children.length - NIETOS_EN_PANEL} más
                    </Link>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
        ))}
      </div>

      <div className="border-t border-ink-100 p-2">
        <Link
          href={`/categoria/${categoria.path}`}
          className="block rounded-lg px-2 py-1.5 text-center text-[13px] font-semibold text-brand-700 transition hover:bg-brand-50"
        >
          Ver toda {categoria.name} →
        </Link>
      </div>
    </div>
  );
}

export function SiteHeader({ categories }: { categories: CategoryLink[] }) {
  const { count, openCart, favorites, hydrated } = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const [term, setTerm] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [expandedCats, setExpandedCats] = useState<string[]>([]);
  const [announcement, setAnnouncement] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);

  /**
   * Cierra el panel un instante después de salir, no en el mismo `mouseleave`.
   * Sin la espera, el panel se dispara al mover el mouse en diagonal desde la
   * barra hacia abajo, que es justo el gesto que hace todo el mundo.
   */
  const abrirPanel = (slug: string | null) => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpenCat(slug);
  };

  const cerrarPanelPronto = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      setOpenCat(null);
      setCatsOpen(false);
    }, 140);
  };

  // Escape cierra cualquier panel abierto: sin esto, con teclado no hay salida.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenCat(null);
      setCatsOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setAnnouncement((i) => (i + 1) % ANNOUNCEMENTS.length), 4200);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setMenuOpen(false);
      setCatsOpen(false);
      setOpenCat(null);
      setOpen(false);
    }, 0);
    return () => window.clearTimeout(id);
  }, [pathname]);

  useEffect(() => {
    if (term.trim().length < 2) {
      const id = window.setTimeout(() => setSuggestions([]), 0);
      return () => window.clearTimeout(id);
    }
    const controller = new AbortController();
    const id = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        if (!res.ok) return;
        const data = (await res.json()) as { results: Suggestion[] };
        setSuggestions(data.results ?? []);
        setOpen(true);
      } catch {
        /* ignored */
      }
    }, 220);
    return () => {
      controller.abort();
      window.clearTimeout(id);
    };
  }, [term]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (!term.trim()) return;
    setOpen(false);
    router.push(`/productos?q=${encodeURIComponent(term.trim())}`);
  };

  return (
    <header className="sticky top-0 z-50">
      <div className="mesh-dark border-b border-white/5 py-1.5 text-center text-[12px] font-medium text-white/85">
        <div className="container-xl flex items-center justify-center gap-2 overflow-hidden">
          <span key={announcement} className="animate-rise">
            {ANNOUNCEMENTS[announcement]}
          </span>
        </div>
      </div>

      <div className="border-b border-ink-100 bg-surface/95 backdrop-blur-md">
        <div className="container-xl flex h-16 items-center gap-3 md:h-[72px] md:gap-5">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Abrir menú"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-ink-100 text-ink-700 lg:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>

          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/logo.png"
              alt="Córdoba Digital"
              className="h-10 w-auto bg-white object-contain"
            />
            <span className="hidden leading-tight sm:block">
              <span className="block text-[15px] font-extrabold tracking-tight text-ink-900">Córdoba Digital</span>
              <span className="block text-[11px] font-medium text-ink-400">Tecnología con garantía · desde 2006</span>
            </span>
          </Link>

          <div ref={boxRef} className="relative hidden flex-1 md:block">
            <form onSubmit={submitSearch} className="relative">
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                onFocus={() => suggestions.length && setOpen(true)}
                placeholder="Buscá tu próximo celular, notebook, cámara..."
                className="h-11 w-full rounded-xl border border-ink-200 bg-ink-50/70 pl-11 pr-28 text-sm text-ink-800 outline-none transition placeholder:text-ink-400 focus:border-brand-400 focus:bg-surface focus:ring-4 focus:ring-brand-100"
              />
              <svg
                viewBox="0 0 24 24"
                className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.2-3.2" strokeLinecap="round" />
              </svg>
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg bg-brand-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-700"
              >
                Buscar
              </button>
            </form>

            {open && suggestions.length > 0 ? (
              <div className="absolute left-0 right-0 top-[52px] z-50 animate-pop overflow-hidden rounded-2xl border border-ink-100 bg-surface shadow-2xl shadow-black/10">
                {suggestions.map((s) => (
                  <Link
                    key={s.slug}
                    href={`/producto/${s.slug}`}
                    className="flex items-center gap-3 border-b border-ink-50 px-3 py-2.5 transition last:border-0 hover:bg-ink-50"
                  >
                    {s.image ? (
                      <Image src={s.image} alt="" width={44} height={44} className="h-11 w-11 rounded-lg object-cover" />
                    ) : null}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink-800">{s.name}</span>
                      <span className="block text-xs text-ink-400">{s.brand}</span>
                    </span>
                    <span className="text-sm font-bold text-ink-900">{money(s.price)}</span>
                  </Link>
                ))}
                <button
                  type="button"
                  onClick={() => router.push(`/productos?q=${encodeURIComponent(term)}`)}
                  className="w-full bg-ink-50 px-3 py-2.5 text-center text-xs font-bold text-brand-700 hover:bg-brand-50"
                >
                  Ver todos los resultados para “{term}”
                </button>
              </div>
            ) : null}
          </div>

          <nav className="ml-auto flex items-center gap-1">
            <ThemeToggle />

            <Link
              href="/seguimiento"
              className="hidden items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-ink-600 transition hover:bg-ink-50 hover:text-ink-900 lg:flex"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z" />
                <circle cx="7" cy="18" r="1.6" />
                <circle cx="17.5" cy="18" r="1.6" />
              </svg>
              Seguir pedido
            </Link>

            <Link
              href="/favoritos"
              className="relative grid h-10 w-10 place-items-center rounded-xl text-ink-600 transition hover:bg-ink-50 hover:text-rose-500"
              aria-label="Favoritos"
            >
              <svg viewBox="0 0 24 24" className="h-5.5 w-5.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 21s-7.5-4.6-9.5-9A5.5 5.5 0 0112 5.5 5.5 5.5 0 0121.5 12c-2 4.4-9.5 9-9.5 9z" />
              </svg>
              {hydrated && favorites.length > 0 ? (
                <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                  {favorites.length}
                </span>
              ) : null}
            </Link>

            <button
              type="button"
              onClick={openCart}
              className="relative flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-3.5 text-sm font-bold text-white transition hover:bg-brand-700"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 4h2.2l2 11h10.4l2-8H6" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="9" cy="19" r="1.6" />
                <circle cx="17" cy="19" r="1.6" />
              </svg>
              <span className="hidden sm:inline">Carrito</span>
              {hydrated && count > 0 ? (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-neon-400 px-1 text-[11px] font-black text-deep">
                  {count}
                </span>
              ) : null}
            </button>
          </nav>
        </div>

        {/* Mobile search */}
        <div className="container-xl pb-3 md:hidden">
          <form onSubmit={submitSearch} className="relative">
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="¿Qué estás buscando?"
              className="h-11 w-full rounded-xl border border-ink-200 bg-ink-50/70 pl-10 pr-4 text-sm outline-none focus:border-brand-400 focus:bg-surface"
            />
            <svg
              viewBox="0 0 24 24"
              className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.2-3.2" strokeLinecap="round" />
            </svg>
          </form>
        </div>

        {/* Desktop category bar */}
        <div
          className="hidden border-t border-ink-100 lg:block"
          // El panel cuelga de la barra; sin esto, al salir del mouse se cerraría
          // en el hueco entre la barra y el panel.
          onMouseLeave={cerrarPanelPronto}
        >
          <div className="container-xl flex h-11 items-center gap-0.5 text-sm">
            {/* Todas las categorías. El botón naranja que había acá se llevaba
                ~150 px de los 1344 disponibles y era lo que obligaba a cortar los
                nombres de al lado. Ahora es texto con un chevron, como el que
                usaste de referencia. */}
            <div className="relative">
              <button
                type="button"
                onMouseEnter={() => {
                  abrirPanel(null);
                  setCatsOpen(true);
                }}
                onFocus={() => setCatsOpen(true)}
                onClick={() => setCatsOpen((v) => !v)}
                aria-expanded={catsOpen}
                aria-haspopup="true"
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 font-semibold text-ink-700 transition hover:bg-ink-50 hover:text-ink-900"
              >
                Categorías
                <svg
                  viewBox="0 0 24 24"
                  className={`h-3.5 w-3.5 transition-transform ${catsOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  aria-hidden
                >
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {catsOpen ? (
                <div
                  onMouseEnter={() => abrirPanel(null)}
                  className="absolute left-0 top-11 z-50 max-h-[70vh] w-[760px] animate-pop overflow-y-auto rounded-2xl border border-ink-100 bg-surface p-3 shadow-2xl shadow-black/10"
                >
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    {categories.map((c) => (
                      <div key={c.slug} className="rounded-xl px-3 py-2 transition hover:bg-ink-50">
                        <Link href={`/categoria/${c.path}`} className="flex items-start gap-3">
                          <span className="text-xl" aria-hidden>
                            {c.icon}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-ink-800">{c.name}</span>
                            <span className="block text-[11px] text-ink-400">
                              {typeof c.count === "number" ? `${c.count} productos` : "Sin productos"}
                            </span>
                          </span>
                        </Link>
                        {c.children?.length ? (
                          <ul className="ml-9 mt-1 space-y-0.5 border-l border-ink-100 pl-3">
                            {c.children.slice(0, 8).map((child) => (
                              <li key={child.slug}>
                                <Link
                                  href={`/categoria/${child.path}`}
                                  className="block truncate text-[12px] text-ink-500 transition hover:text-brand-700"
                                >
                                  {child.name}
                                </Link>
                              </li>
                            ))}
                            {c.children.length > 8 ? (
                              <li>
                                <Link
                                  href={`/categoria/${c.path}`}
                                  className="block text-[11px] font-semibold text-brand-700 hover:text-brand-800"
                                >
                                  Ver las {c.children.length} subcategorías →
                                </Link>
                              </li>
                            ) : null}
                          </ul>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Las 6 de la barra. Cada una abre su propio panel con las
                subcategorías; las 12 categorías raíz sin hijos no abren nada y
                el click va directo a su página. */}
            {categories.slice(0, CATEGORIAS_EN_BARRA).map((c) => {
              const tienePanel = Boolean(c.children?.length);
              const activo = openCat === c.slug;
              return (
                <div key={c.slug} className="relative">
                  <Link
                    href={`/categoria/${c.path}`}
                    onMouseEnter={() => {
                      if (tienePanel) abrirPanel(c.slug);
                      else setCatsOpen(false);
                    }}
                    onFocus={() => tienePanel && abrirPanel(c.slug)}
                    aria-expanded={tienePanel ? activo : undefined}
                    aria-haspopup={tienePanel ? "true" : undefined}
                    className={`block max-w-[11rem] truncate rounded-lg px-3 py-1.5 font-medium transition hover:bg-ink-50 hover:text-ink-900 ${
                      activo ? "bg-ink-50 text-ink-900" : "text-ink-600"
                    }`}
                    title={c.name}
                  >
                    {c.name}
                  </Link>
                  {activo ? <PanelCategoria categoria={c} /> : null}
                </div>
              );
            })}
            <Link
              href="/productos?ofertas=1"
              className="ml-auto rounded-lg px-3 py-1.5 font-bold text-rose-600 transition hover:bg-rose-50"
            >
              🔥 Ofertas
            </Link>
            <Link href="/ayuda" className="rounded-lg px-3 py-1.5 font-medium text-ink-600 transition hover:bg-ink-50">
              Ayuda
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-deep/50" onClick={() => setMenuOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-[85%] max-w-sm animate-pop overflow-y-auto bg-surface p-5">
            <div className="mb-5 flex items-center justify-between">
              <span className="text-lg font-extrabold">Menú</span>
              <button type="button" onClick={() => setMenuOpen(false)} className="text-2xl text-ink-400">
                ×
              </button>
            </div>
            <div className="space-y-1">
              {categories.map((c) => {
                const expanded = expandedCats.includes(c.slug);
                const hasKids = Boolean(c.children?.length);
                return (
                  <div key={c.slug} className="rounded-xl">
                    <div className="flex items-center">
                      <Link
                        href={`/categoria/${c.path}`}
                        className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-sm font-semibold text-ink-700 hover:bg-ink-50"
                      >
                        <span className="text-xl" aria-hidden>
                          {c.icon}
                        </span>
                        <span className="truncate">{c.name}</span>
                      </Link>
                      {hasKids ? (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedCats((prev) =>
                              prev.includes(c.slug) ? prev.filter((s) => s !== c.slug) : [...prev, c.slug],
                            )
                          }
                          aria-expanded={expanded}
                          aria-label={`Ver subcategorías de ${c.name}`}
                          className="px-3 py-3 text-ink-400"
                        >
                          <span className={`block transition ${expanded ? "rotate-180" : ""}`}>▾</span>
                        </button>
                      ) : null}
                    </div>
                    {hasKids && expanded ? (
                      <ul className="mb-1 ml-6 space-y-0.5 border-l border-ink-100 pl-3">
                        {c.children!.map((child) => (
                          <li key={child.slug}>
                            <Link
                              href={`/categoria/${child.path}`}
                              className="flex items-center justify-between gap-2 py-1.5 text-[13px] text-ink-600 hover:text-brand-700"
                            >
                              <span className="truncate">{child.name}</span>
                              {typeof child.count === "number" ? (
                                <span className="shrink-0 text-[11px] text-ink-300">{child.count}</span>
                              ) : null}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="mt-5 space-y-1 border-t border-ink-100 pt-4 text-sm font-semibold text-ink-700">
              <Link href="/productos?ofertas=1" className="block rounded-xl px-3 py-2.5 text-rose-600 hover:bg-rose-50">
                🔥 Ofertas de la semana
              </Link>
              <Link href="/favoritos" className="block rounded-xl px-3 py-2.5 hover:bg-ink-50">
                ❤ï¸ Mis favoritos
              </Link>
              <Link href="/seguimiento" className="block rounded-xl px-3 py-2.5 hover:bg-ink-50">
                📦 Seguir mi pedido
              </Link>
              <Link href="/ayuda" className="block rounded-xl px-3 py-2.5 hover:bg-ink-50">
                💬 Centro de ayuda
              </Link>
            </div>
            <a
              href="https://wa.me/5493516777774"
              target="_blank"
              rel="noreferrer"
              className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white"
            >
              Escribinos por WhatsApp
            </a>
          </div>
        </div>
      ) : null}
    </header>
  );
}
