"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { CategoryNavBar, type CategoryNavRoot } from "@/components/hdr-category-nav";
import { useStore } from "@/components/store-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { money } from "@/lib/format";

type CategoryLink = CategoryNavRoot;

type Suggestion = {
  slug: string;
  name: string;
  brand: string;
  price: number;
  image: string | null;
  categorySlug: string;
};

const ANNOUNCEMENTS = [
  "🏦 Transferencia bancaria, USDT o efectivo en el local",
  "🚚 Envíos a todo el país por Andreani, a domicilio o a sucursal",
  "🏬 Retiro en 27 de Abril 180, Córdoba Capital",
  "🛡️ 6 meses de garantía legal + soporte post-venta local",
];

export function SiteHeader({ categories }: { categories: CategoryLink[] }) {
  const { count, openCart, favorites, hydrated } = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const [term, setTerm] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [expandedCats, setExpandedCats] = useState<string[]>([]);
  const [announcement, setAnnouncement] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = window.setInterval(() => setAnnouncement((i) => (i + 1) % ANNOUNCEMENTS.length), 4200);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setMenuOpen(false);
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
              <span className="block text-[11px] font-medium text-ink-500">Tecnología con garantía legal</span>
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
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg bg-brand-700 px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-800"
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
                      <span className="block text-xs text-ink-500">{s.brand}</span>
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
                <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                  {favorites.length}
                </span>
              ) : null}
            </Link>

            <button
              type="button"
              onClick={openCart}
              className="relative flex h-10 items-center gap-2 rounded-xl bg-brand-700 px-3.5 text-sm font-bold text-white transition hover:bg-brand-800"
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
        <CategoryNavBar categories={categories} />
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
                                <span className="shrink-0 text-[11px] text-ink-500">{child.count}</span>
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
                ❤️ Mis favoritos
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
      ) : null}
    </header>
  );
}
