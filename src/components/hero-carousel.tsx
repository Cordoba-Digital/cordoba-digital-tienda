"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { ProductImg } from "@/components/product-img";
import { money } from "@/lib/format";

export type HeroSlide = {
  id: string;
  pill: string;
  titleLead: string;
  titleAccent: string;
  text: string;
  cta: { href: string; label: string };
  cta2?: { href: string; label: string };
  stats: { k: string; v: string }[];
  product: {
    slug: string;
    name: string;
    image: string;
    srcSet?: string[];
    price: number;
    compareAtPrice: number | null;
  } | null;
};

const INTERVAL_MS = 6500;

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const touchX = useRef<number | null>(null);

  const go = useCallback((delta: number) => setIndex((i) => (i + delta + count) % count), [count]);

  // Solo suscribe al cambio; el valor inicial sale del useState de arriba.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event: MediaQueryListEvent) => setReduceMotion(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Avance automático: `index` queda fuera de las dependencias a propósito.
  // Con el tick funcional el timer no se recrea en cada diapositiva y no hay
  // deriva; el cambio manual igual reinicia el ciclo porque `go` re-renderiza
  // pero el intervalo sigue su ritmo.
  useEffect(() => {
    if (paused || reduceMotion || count < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), INTERVAL_MS);
    return () => clearInterval(timer);
  }, [paused, reduceMotion, count]);

  return (
    <section
      className="mesh-dark relative overflow-hidden"
      role="region"
      aria-roledescription="carrusel"
      aria-label="Destacados de la tienda"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}
      onTouchStart={(event) => {
        touchX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        if (touchX.current == null) return;
        const dx = (event.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
      }}
    >
      <div
        className="flex transition-transform duration-500 ease-out motion-reduce:transition-none"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((slide, i) => {
          const active = i === index;
          // Entrada escalonada solo del slide activo: fade + rise (solo
          // transform/opacity, sin layout) con keyframes propios `hero-enter`.
          // Sin `key` ni remontajes: las fotos persisten y no reflashean.
          const enter = active && !reduceMotion;
          const enterClass = enter ? " animate-hero-enter motion-reduce:animate-none" : "";
          const enterStyle = (ms: number) => (enter ? { animationDelay: `${ms}ms` } : undefined);
          // Un solo `h1` en toda la home: el del primer slide. El resto usa el
          // mismo estilo en un `p` para no romper la jerarquía de títulos.
          const Title = i === 0 ? "h1" : "p";
          const statsCols =
            slide.stats.length >= 4 ? "grid-cols-2 sm:grid-cols-4" : slide.stats.length === 3 ? "grid-cols-3" : "grid-cols-2";
          return (
            <div
              key={slide.id}
              role="group"
              aria-roledescription="diapositiva"
              aria-label={`${i + 1} de ${count}`}
              aria-hidden={!active}
              inert={!active}
              className="w-full shrink-0"
            >
              <div
                className={`container-xl relative grid items-center gap-8 py-9 lg:py-12 ${
                  slide.product ? "lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]" : "lg:max-w-3xl"
                }`}
              >
                <div className="animate-rise">
                  <span className={`inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur${enterClass}`} style={enterStyle(0)}>
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neon-400" />
                    {slide.pill}
                  </span>
                  <Title className={`mt-3.5 text-balance-pretty text-[1.75rem] font-black leading-[1.08] tracking-tight text-white sm:text-4xl lg:text-[2.6rem]${enterClass}`} style={enterStyle(70)}>
                    {slide.titleLead}{" "}
                    <span className="bg-gradient-to-r from-neon-400 to-brand-300 bg-clip-text text-transparent">
                      {slide.titleAccent}
                    </span>
                  </Title>
                  <p className={`mt-3.5 max-w-xl text-[15px] leading-relaxed text-ink-200${enterClass}`} style={enterStyle(140)}>{slide.text}</p>
                  <div className={`mt-5 flex flex-wrap gap-2.5${enterClass}`} style={enterStyle(210)}>
                    <Link
                      href={slide.cta.href}
                      className="rounded-xl bg-gradient-to-r from-brand-500 to-neon-500 px-5 py-3 text-sm font-extrabold text-white shadow-[0_18px_40px_-16px_rgba(194,65,12,0.55)] transition hover:opacity-95"
                    >
                      {slide.cta.label}
                    </Link>
                    {slide.cta2 ? (
                      <Link
                        href={slide.cta2.href}
                        className="rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/10"
                      >
                        {slide.cta2.label}
                      </Link>
                    ) : null}
                  </div>
                  <dl className={`mt-6 grid max-w-xl gap-2.5 ${statsCols}`}>
                    {slide.stats.map((stat) => (
                      <div key={stat.v} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 backdrop-blur">
                        <dt className="text-base font-black leading-none text-white">{stat.k}</dt>
                        <dd className="mt-1 text-[10px] font-medium uppercase tracking-wide text-ink-300">{stat.v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                {slide.product ? (
                  <div className={`relative${enterClass}`} style={enterStyle(280)}>
                    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl">
                      <div className="aspect-[4/3] lg:aspect-[5/4]">
                        <ProductImg
                          src={slide.product.image}
                          srcSet={slide.product.srcSet}
                          alt={slide.product.name}
                          sizes="(max-width: 1024px) 100vw, 40vw"
                          width={800}
                          height={640}
                          priority={i === 0}
                          className="h-full w-full object-contain p-8"
                        />
                      </div>
                    </div>

                    <Link
                      href={`/producto/${slide.product.slug}`}
                      className="absolute -bottom-5 left-2 hidden w-[18rem] animate-float-slow rounded-2xl border border-ink-100 bg-surface p-3 shadow-2xl sm:block"
                    >
                      <div className={`flex items-center gap-3${enterClass}`} style={enterStyle(350)}>
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-ink-50">
                          <ProductImg
                            src={slide.product.image}
                            srcSet={slide.product.srcSet}
                            alt=""
                            sizes="56px"
                            width={56}
                            height={56}
                            className="h-full w-full object-contain p-1"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="line-clamp-1 text-xs font-bold text-ink-800">{slide.product.name}</p>
                          <p className="text-sm font-black text-ink-900">{money(slide.product.price)}</p>
                          {/* Acá decía "6 cuotas sin interés". No hay cuotas en el
                              sitio original, así que no se anuncia nada. */}
                        </div>
                      </div>
                    </Link>

                    <div className="absolute -right-2 top-6 hidden animate-float-slow rounded-2xl border border-white/15 bg-deep/80 px-4 py-3 text-white backdrop-blur md:block">
                      <p className={`text-[11px] uppercase tracking-wide text-ink-300${enterClass}`} style={enterStyle(420)}>Envío a todo el país</p>
                      <p className={`text-xl font-black text-neon-400${enterClass}`} style={enterStyle(420)}>Andreani</p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {count > 1 ? (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Diapositiva anterior"
            className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white text-deep shadow-lg transition hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-neon-400 sm:grid"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Diapositiva siguiente"
            className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white text-deep shadow-lg transition hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-neon-400 sm:grid"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center rounded-full bg-black/25 px-2.5 py-0.5 backdrop-blur">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Ir a la diapositiva ${i + 1}: ${slide.id}`}
                aria-current={i === index}
                className="grid h-11 w-8 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-neon-400"
              >
                <span className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-brand-500/90" : "w-1.5 bg-white/40 hover:bg-white/70"}`} />
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? "Reanudar carrusel" : "Pausar carrusel"}
              aria-pressed={paused}
              className="grid h-11 w-8 place-items-center rounded-full text-white/60 transition hover:text-white focus-visible:outline-2 focus-visible:outline-neon-400"
            >
              {paused ? (
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden>
                  <path d="M7 4l13 8-13 8z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden>
                  <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
                </svg>
              )}
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
