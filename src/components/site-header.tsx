"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { CategoryIcon } from "@/components/category-icon";
import { CategoryNavBar, type CategoryNavRoot } from "@/components/hdr-category-nav";
import {
  SearchSuggestions,
  suggestionHrefs,
  type SearchShortcut,
  type SearchSuggestion,
} from "@/components/search-suggestions";
import { useStore } from "@/components/store-provider";

type CategoryLink = CategoryNavRoot;

const ANNOUNCEMENTS = [
  "🏦 Transferencia bancaria o efectivo/seña en el local",
  "🚚 Envíos a todo el país por Andreani, a domicilio o a sucursal",
  "🏬 Retiro en 27 de Abril 180, Córdoba Capital",
  "🛡️ 6 meses de garantía legal + soporte post-venta local",
];

export function SiteHeader({ categories, topBar = true }: { categories: CategoryLink[]; topBar?: boolean }) {
  const { count, openCart, favorites, hydrated } = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const [term, setTerm] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [shortcuts, setShortcuts] = useState<SearchShortcut[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // El menú se monta recién la primera vez que se abre (no suma HTML a cada
  // página) y después queda montado, para que pueda entrar y salir deslizando.
  const [menuMounted, setMenuMounted] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuCloseRef = useRef<HTMLButtonElement>(null);
  const [expandedCats, setExpandedCats] = useState<string[]>([]);
  const [announcement, setAnnouncement] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const mobileBoxRef = useRef<HTMLDivElement>(null);
  // Cliente con sesión: el ícono de cuenta muestra su foto o inicial.
  const [me, setMe] = useState<{ name: string; email: string; avatarUrl: string } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { user?: { name: string; email: string; avatarUrl: string } | null } | null) => {
        if (alive) setMe(data?.user ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pathname]);

  // Con el menú abierto la página de atrás no scrollea, Escape lo cierra y el
  // foco va a la X; al cerrarlo vuelve a la hamburguesa.
  useEffect(() => {
    if (!menuOpen) return;
    const button = menuButtonRef.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    menuCloseRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      if (button && document.activeElement && document.activeElement !== document.body) button.focus({ preventScroll: true });
    };
  }, [menuOpen]);

  const openMenu = () => {
    setMenuMounted(true);
    // Dos cuadros: el primero pinta el cajón afuera de la pantalla y el
    // segundo lo abre, así la transición arranca desde el borde.
    requestAnimationFrame(() => requestAnimationFrame(() => setMenuOpen(true)));
  };

  useEffect(() => {
    if (!topBar) return;
    const id = window.setInterval(() => setAnnouncement((i) => (i + 1) % ANNOUNCEMENTS.length), 4200);
    return () => window.clearInterval(id);
  }, [topBar]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setMenuOpen(false);
      setOpen(false);
    }, 0);
    return () => window.clearTimeout(id);
  }, [pathname]);

  useEffect(() => {
    if (term.trim().length < 2) {
      const id = window.setTimeout(() => {
        setSuggestions([]);
        setShortcuts([]);
      }, 0);
      return () => window.clearTimeout(id);
    }
    const controller = new AbortController();
    const id = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        if (!res.ok) return;
        const data = (await res.json()) as { results: SearchSuggestion[]; shortcuts?: SearchShortcut[] };
        setSuggestions(data.results ?? []);
        setShortcuts(data.shortcuts ?? []);
        setActive(-1);
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
      const target = event.target as Node;
      if (!boxRef.current?.contains(target) && !mobileBoxRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const hasSuggestions = suggestions.length > 0 || shortcuts.length > 0;
  const showSuggestions = open && hasSuggestions && term.trim().length >= 2;

  // Flechas para recorrer el desplegable, Enter para ir y Escape para cerrarlo.
  const onSearchKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      setActive(-1);
      return;
    }
    if (!hasSuggestions) return;
    const hrefs = suggestionHrefs(term, shortcuts, suggestions);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      // -1 es volver al texto escrito; da la vuelta en los dos extremos.
      const slots = hrefs.length + 1;
      setActive((i) => ((((i + 1 + step) % slots) + slots) % slots) - 1);
    } else if (event.key === "Enter" && showSuggestions && active >= 0 && active < hrefs.length) {
      event.preventDefault();
      setOpen(false);
      router.push(hrefs[active]);
    }
  };

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (!term.trim()) return;
    setOpen(false);
    router.push(`/productos?q=${encodeURIComponent(term.trim())}`);
  };

  return (
    <header className="sticky top-0 z-50">
      {/* Barra de avisos: se apaga desde Panel → Inicio. */}
      {topBar ? (
        <div className="bg-brand-700 py-1 text-center text-[11px] font-medium text-white sm:py-1.5 sm:text-[12px]">
          <div className="container-xl flex items-center justify-center gap-2 overflow-hidden">
            <span key={announcement} className="animate-rise">
              {ANNOUNCEMENTS[announcement]}
            </span>
          </div>
        </div>
      ) : null}

      <div className="border-b border-ink-100 bg-surface/95 backdrop-blur-md">
        <div className="container-xl flex h-14 items-center gap-2 sm:h-16 sm:gap-3 md:h-[72px] md:gap-5">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={openMenu}
            aria-label="Abrir menú"
            aria-expanded={menuOpen}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-ink-100 text-ink-700 sm:h-10 sm:w-10 lg:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>

          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <Image src="/images/logo.png" alt="Córdoba Digital" width={160} height={64} className="h-10 w-auto object-contain sm:h-12" priority />
          </Link>

          <div ref={boxRef} className="relative hidden flex-1 md:block">
            <form onSubmit={submitSearch} className="relative">
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                onFocus={() => hasSuggestions && setOpen(true)}
                onKeyDown={onSearchKey}
                role="combobox"
                aria-expanded={showSuggestions}
                aria-controls="busqueda-sugerencias"
                aria-autocomplete="list"
                aria-activedescendant={showSuggestions && active >= 0 ? `busqueda-sugerencias-${active}` : undefined}
                placeholder="Buscá tu próximo celular, notebook, cámara..."
                className="h-11 w-full rounded-full border border-ink-100 bg-ink-50/80 pl-11 pr-28 text-sm text-ink-800 outline-none transition placeholder:text-ink-400 focus:border-brand-400 focus:bg-surface focus:ring-4 focus:ring-brand-100"
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
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-brand-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-600"
              >
                Buscar
              </button>
            </form>

            {showSuggestions ? (
              <SearchSuggestions
                id="busqueda-sugerencias"
                term={term}
                shortcuts={shortcuts}
                results={suggestions}
                active={active}
                onHover={setActive}
                onPick={() => setOpen(false)}
              />
            ) : null}
          </div>

          <nav className="ml-auto flex items-center gap-1">
            <Link
              href="/seguimiento"
              className="hidden items-center gap-2 rounded-full border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-600 transition hover:bg-ink-50 hover:text-ink-900 lg:flex"
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
              className="relative grid h-9 w-9 place-items-center rounded-full border border-ink-100 text-ink-600 transition hover:bg-ink-50 hover:text-rose-500 sm:h-10 sm:w-10"
              aria-label="Favoritos"
            >
              <svg viewBox="0 0 24 24" className="h-5.5 w-5.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 21s-7.5-4.6-9.5-9A5.5 5.5 0 0112 5.5 5.5 5.5 0 0121.5 12c-2 4.4-9.5 9-9.5 9z" />
              </svg>
              {hydrated && favorites.length > 0 ? (
                <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                  {favorites.length}
                </span>
              ) : null}
            </Link>

            <Link
              href="/mi-cuenta"
              className="grid h-9 w-9 place-items-center overflow-hidden rounded-full border border-ink-100 text-ink-600 transition hover:bg-ink-50 hover:text-brand-700 sm:h-10 sm:w-10"
              aria-label={me ? `Mi cuenta (${me.name || me.email})` : "Mi cuenta"}
              title={me ? `Ingresaste como ${me.email}` : "Ingresar"}
            >
              {me?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={me.avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : me ? (
                <span className="grid h-full w-full place-items-center bg-ink-900 text-sm font-black text-white">
                  {(me.name || me.email).slice(0, 1).toUpperCase()}
                </span>
              ) : (
                <svg viewBox="0 0 24 24" className="h-5.5 w-5.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="8" r="3.5" />
                  <path d="M4.5 20c1.5-3.5 4.5-5 7.5-5s6 1.5 7.5 5" />
                </svg>
              )}
            </Link>

            <button
              type="button"
              onClick={openCart}
              className="relative flex h-9 items-center gap-2 rounded-full bg-brand-500 px-3 text-sm font-bold text-white transition hover:bg-brand-600 sm:h-10 sm:px-4"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 4h2.2l2 11h10.4l2-8H6" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="9" cy="19" r="1.6" />
                <circle cx="17" cy="19" r="1.6" />
              </svg>
              <span className="hidden sm:inline">Carrito</span>
              {hydrated && count > 0 ? (
                // La `key` reinicia el salto cada vez que cambia la cantidad.
                <span
                  key={count}
                  className="grid h-5 min-w-5 animate-bump place-items-center rounded-full bg-neon-400 px-1 text-[11px] font-black text-deep motion-reduce:animate-none"
                >
                  {count}
                </span>
              ) : null}
            </button>
          </nav>
        </div>

        {/* Mobile search */}
        <div ref={mobileBoxRef} className="container-xl relative pb-2 sm:pb-3 md:hidden">
          <form onSubmit={submitSearch} className="relative">
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onFocus={() => hasSuggestions && setOpen(true)}
              onKeyDown={onSearchKey}
              enterKeyHint="search"
              placeholder="¿Qué estás buscando?"
              className="h-10 w-full rounded-full border border-ink-100 bg-ink-50/80 pl-10 pr-4 text-sm outline-none focus:border-brand-400 focus:bg-surface sm:h-11"
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
          {showSuggestions ? (
            <div className="absolute inset-x-4 top-0">
              <SearchSuggestions
                id="busqueda-sugerencias-movil"
                term={term}
                shortcuts={shortcuts}
                results={suggestions}
                active={active}
                onHover={setActive}
                onPick={() => setOpen(false)}
              />
            </div>
          ) : null}
        </div>

        {/* Desktop category bar */}
        <CategoryNavBar categories={categories} />
      </div>

      {/*
        Menú del celular: un cajón que entra deslizando desde la izquierda con
        el fondo oscureciéndose, y sale igual. Las subcategorías se despliegan
        con una animación de alto (grid de 0fr a 1fr), sin saltos. Va en un
        portal al `body` con z-60, como el carrito: dentro del header (z-50)
        quedaba debajo del botón flotante de WhatsApp.
      */}
      {menuMounted ? createPortal(
        <div
          className={`fixed inset-0 z-[60] lg:hidden ${menuOpen ? "" : "pointer-events-none"}`}
          inert={!menuOpen}
          aria-hidden={!menuOpen}
        >
          <div
            className={`absolute inset-0 bg-deep/50 transition-opacity duration-300 motion-reduce:transition-none ${menuOpen ? "opacity-100" : "opacity-0"}`}
            onClick={() => setMenuOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menú"
            className={`absolute inset-y-0 left-0 flex w-[85%] max-w-sm flex-col bg-surface shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
              menuOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
              <span className="text-lg font-extrabold text-ink-900">Menú</span>
              <button
                ref={menuCloseRef}
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Cerrar menú"
                className="grid h-9 w-9 place-items-center rounded-full text-ink-500 transition hover:bg-ink-50 hover:text-ink-900 active:scale-90"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-3 pb-5 pt-3" data-lenis-prevent>
              <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-400">Categorías</p>
              <div className="space-y-0.5">
                {categories.map((c, index) => {
                  const expanded = expandedCats.includes(c.slug);
                  const hasKids = Boolean(c.children?.length);
                  return (
                    <div
                      key={c.slug}
                      // Al abrir, las categorías aparecen en cascada, apenas
                      // corridas una de otra.
                      style={{ transitionDelay: menuOpen ? `${Math.min(index, 12) * 25 + 60}ms` : "0ms" }}
                      className={`rounded-xl transition duration-300 motion-reduce:transition-none ${
                        menuOpen ? "translate-x-0 opacity-100" : "-translate-x-3 opacity-0"
                      } ${expanded ? "bg-brand-50/60" : ""}`}
                    >
                      <div className="flex items-center">
                        <Link
                          href={`/categoria/${c.path}`}
                          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 active:bg-brand-50"
                        >
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                            <CategoryIcon name={c.name} className="h-[18px] w-[18px]" />
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
                            aria-label={`${expanded ? "Ocultar" : "Ver"} subcategorías de ${c.name}`}
                            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors active:bg-brand-100 ${
                              expanded ? "text-brand-700" : "text-ink-400 hover:text-ink-700"
                            }`}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              className={`h-4 w-4 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M6 9l6 6 6-6" />
                            </svg>
                          </button>
                        ) : null}
                      </div>
                      {hasKids ? (
                        <div
                          className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
                            expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                          }`}
                          inert={!expanded}
                        >
                          <div className="overflow-hidden">
                            <ul className="mb-2 ml-7 space-y-0.5 border-l border-brand-100 pl-3">
                              {c.children!.map((child) => (
                                <li key={child.slug}>
                                  <Link
                                    href={`/categoria/${child.path}`}
                                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[13px] text-ink-600 transition-colors hover:text-brand-700 active:bg-brand-50"
                                  >
                                    <span className="truncate">{child.name}</span>
                                    {typeof child.count === "number" ? (
                                      <span className="shrink-0 text-[11px] text-ink-500">{child.count}</span>
                                    ) : null}
                                  </Link>
                                  {child.children?.length ? (
                                    <ul className="mb-1 ml-4 space-y-0.5 border-l border-ink-100 pl-3">
                                      {child.children.map((grand) => (
                                        <li key={grand.slug}>
                                          <Link
                                            href={`/categoria/${grand.path}`}
                                            className="block truncate py-1 text-xs text-ink-500 hover:text-brand-700"
                                          >
                                            {grand.name}
                                          </Link>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
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
                  ❤️ Mis favoritos
                </Link>
                <Link href="/mi-cuenta" className="block rounded-xl px-3 py-2.5 hover:bg-ink-50">
                  👤 {me ? `Mi cuenta · ${(me.name || me.email).split(" ")[0]}` : "Ingresar / Mi cuenta"}
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
                className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white"
              >
                Escribinos por WhatsApp
              </a>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </header>
  );
}
