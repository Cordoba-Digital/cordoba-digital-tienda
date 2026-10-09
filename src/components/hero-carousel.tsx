"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Truck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ProductImg } from "@/components/product-img";
import { useStore } from "@/components/store-provider";
import { discountPercent, money } from "@/lib/format";

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
    brand: string;
    image: string;
    srcSet?: string[];
    price: number;
    compareAtPrice: number | null;
    stock: number;
    freeShipping: boolean;
  } | null;
};

const INTERVAL_MS = 3000;

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const { addItem } = useStore();
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  // Distancia del hero al borde de arriba (barra + header + menú). En
  // escritorio el hero se dimensiona para que, al abrir la página, entren
  // completos él y el cintillo de confianza que lo pisa (~88 px).
  const [heroTop, setHeroTop] = useState<number | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const touchX = useRef<number | null>(null);
  // Panel táctil: manda muchos eventos chicos por swipe (3-15 px) en vez de
  // uno grande, así que se acumulan en una ventana corta y se dispara al
  // llegar al total. El candado evita saltear varios slides de un gesto.
  const wheelAcc = useRef({ x: 0, at: 0 });
  const wheelLock = useRef(0);

  const go = useCallback((delta: number) => setIndex((i) => (i + delta + count) % count), [count]);

  // Solo suscribe al cambio; el valor inicial sale del useState de arriba.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const id = window.setTimeout(() => setReduceMotion(mq.matches), 0);
    const onChange = (event: MediaQueryListEvent) => setReduceMotion(event.matches);
    mq.addEventListener("change", onChange);
    return () => {
      window.clearTimeout(id);
      mq.removeEventListener("change", onChange);
    };
  }, []);

  useEffect(() => {
    const measure = () => {
      const el = sectionRef.current;
      if (el) setHeroTop(Math.round(el.getBoundingClientRect().top + window.scrollY));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Avance automático: `index` queda fuera de las dependencias a propósito.
  // Con el tick funcional el timer no se recrea en cada diapositiva y no hay
  // deriva; el cambio manual igual reinicia el ciclo porque `go` re-renderiza
  // pero el intervalo sigue su ritmo.
  useEffect(() => {
    if (paused || count < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), INTERVAL_MS);
    return () => clearInterval(timer);
  }, [paused, count, index]);

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="mesh-dark relative overflow-hidden lg:flex lg:h-[clamp(25rem,calc(100svh-var(--hero-top,150px)-88px),40rem)] lg:flex-col"
      style={heroTop ? ({ "--hero-top": `${heroTop}px` } as React.CSSProperties) : undefined}
      role="region"
      aria-roledescription="carrusel"
      aria-label="Destacados de la tienda"
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        // Solo el teclado pausa: el mouse ya no frena la rotación (quedaba
        // quieto con el cursor apoyado y parecía roto). Con foco dentro se
        // pausa igual, por accesibilidad.
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
      onWheel={(event) => {
        // Solo gestos predominantemente horizontales (swipe de dos dedos del
        // panel táctil). La rueda vertical no se intercepta: sigue scrolleando
        // la página con normalidad (sin preventDefault).
        if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
        const now = Date.now();
        // Ventana corta: pausas largas reinician el acumulado (evita que el
        // jitter sume de a poco hasta disparar solo).
        if (now - wheelAcc.current.at > 200) wheelAcc.current.x = 0;
        wheelAcc.current.at = now;
        wheelAcc.current.x += event.deltaX;
        if (Math.abs(wheelAcc.current.x) < 60) return;
        if (now - wheelLock.current < 900) return;
        wheelLock.current = now;
        const dir = wheelAcc.current.x > 0 ? 1 : -1;
        wheelAcc.current.x = 0;
        go(dir);
      }}
    >
      <div
        className="flex transition-transform duration-300 ease-out motion-reduce:transition-none lg:min-h-0 lg:flex-1"
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
          const producto = slide.product;
          const sinStock = producto ? producto.stock === 0 : true;
          // Solo se anuncia descuento cuando hay uno real en la base: el
          // porcentaje sale de comparar el precio actual con el anterior.
          const off = producto ? discountPercent(producto.price, producto.compareAtPrice) : 0;

          const agregar = (event: React.MouseEvent<HTMLButtonElement>) => {
            // El botón vive dentro de la diapositiva, que tiene manejadores de
            // toque y rueda. Sin esto el clic podría contarse como gesto.
            event.preventDefault();
            event.stopPropagation();
            if (!producto || sinStock) return;
            // Misma forma que usa `ProductCard`: el carrito guardaría el
            // producto incompleto y el panel de pedidos lo mostraría sin marca.
            addItem({
              slug: producto.slug,
              name: producto.name,
              brand: producto.brand,
              image: producto.image,
              imageSrcSet: producto.srcSet,
              price: producto.price,
              compareAtPrice: producto.compareAtPrice,
              stock: producto.stock,
              freeShipping: producto.freeShipping,
            });
          };

          return (
            <div
              key={slide.id}
              role="group"
              aria-roledescription="diapositiva"
              aria-label={`${i + 1} de ${count}`}
              aria-hidden={!active}
              inert={!active}
              className="w-full shrink-0 lg:h-full"
            >
              <div
                className={`container-xl relative grid items-center gap-8 pb-4 pt-9 lg:h-full lg:pb-0 lg:pt-6 ${
                  producto ? "lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]" : "lg:max-w-3xl"
                }`}
              >
                <div>
                  <span className={`inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur${enterClass}`} style={enterStyle(0)}>
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden />
                    {slide.pill}
                  </span>
                  <Title className={`mt-3.5 text-balance-pretty text-[1.75rem] font-black leading-[1.08] tracking-tight text-white sm:text-4xl lg:text-[2.6rem]${enterClass}`} style={enterStyle(70)}>
                    {slide.titleLead}{" "}
                    {/* Naranja sólido, no degradado: `brand-400` da 6,45:1 sobre
                        el fondo del hero (`#14161c`), bien por encima de AA. */}
                    <span className="text-brand-400">{slide.titleAccent}</span>
                  </Title>
                  <p className={`mt-3.5 max-w-xl text-[15px] leading-relaxed text-white/70${enterClass}`} style={enterStyle(140)}>{slide.text}</p>
                  {/* Botones píldora. El naranja de marca lleva la etiqueta en
                      tinta oscura y no en blanco: `brand-500` es un naranja
                      claro y con blanco da 3,37:1, que no pasa los 4,5:1 de
                      WCAG AA para texto chico. Sobre tinta da 5,36:1. */}
                  <div className={`mt-5 flex flex-wrap gap-2.5${enterClass}`} style={enterStyle(210)}>
                    <Link
                      href={slide.cta.href}
                      className="rounded-full bg-brand-500 px-5 py-3 text-sm font-extrabold text-deep transition hover:bg-brand-400"
                    >
                      {slide.cta.label}
                    </Link>
                    {slide.cta2 ? (
                      <Link
                        href={slide.cta2.href}
                        className="rounded-full border border-white/20 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                      >
                        {slide.cta2.label}
                      </Link>
                    ) : null}
                  </div>
                  <dl className={`mt-6 grid max-w-xl gap-2.5 ${statsCols}`}>
                    {slide.stats.map((stat) => (
                      <div key={stat.v} className={`rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 backdrop-blur${enterClass}`} style={enterStyle(280)}>
                        <dt className="text-base font-black leading-none text-white">{stat.k}</dt>
                        <dd className="mt-1 text-[10px] font-medium uppercase tracking-wide text-white/45">{stat.v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                {/*
                  Una sola tarjeta blanca con todo el producto adentro. Antes la
                  información iba en una mini tarjeta flotante superpuesta abajo
                  a la izquierda, que terminaba tapando los puntos de avance, y
                  había además un cartel "Andreani" suelto arriba a la derecha.
                  Ahora los datos, el precio y los dos botones viven en la
                  tarjeta y no hay nada flotando por encima.
                */}
                {producto ? (
                  <div className={`relative lg:h-full lg:min-h-0${enterClass}`} style={enterStyle(280)}>
                    <article className="rounded-[28px] bg-surface p-4 lg:flex lg:h-full lg:flex-col shadow-[0_28px_70px_-34px_rgba(20,22,28,0.5)] ring-1 ring-black/5 sm:p-5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-deep px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                          <Truck size={12} strokeWidth={2.4} aria-hidden />
                          Envío Andreani
                        </span>
                        {off > 0 ? (
                          <span className="text-[13px] font-extrabold text-rose-600">{off}% OFF</span>
                        ) : null}
                      </div>

                      <div className="mt-3 overflow-hidden rounded-2xl bg-white lg:min-h-0 lg:flex-1">
                        <div className="aspect-[16/10] p-4 lg:aspect-auto lg:h-full lg:p-3">
                          <ProductImg
                            src={producto.image}
                            srcSet={producto.srcSet}
                            alt={producto.name}
                            sizes="(max-width: 1024px) 100vw, 40vw"
                            width={800}
                            height={500}
                            priority={i === 0}
                            className="h-full w-full object-contain"
                          />
                        </div>
                      </div>

                      <div className="mt-3.5">
                        {producto.brand && producto.brand !== "General" ? (
                          <p className="text-[10px] uppercase tracking-[0.14em] text-ink-400">{producto.brand}</p>
                        ) : null}
                        <Link
                          href={`/producto/${producto.slug}`}
                          className={`mt-1 block line-clamp-2 text-[15px] font-bold leading-snug text-ink-900 hover:text-brand-700${enterClass}`}
                          style={enterStyle(350)}
                        >
                          {producto.name}
                        </Link>
                        <div className={`mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5${enterClass}`} style={enterStyle(350)}>
                          <p className="text-[17px] font-extrabold leading-none tracking-tight text-ink-900">
                            {money(producto.price)}
                          </p>
                          {producto.compareAtPrice ? (
                            <p className="text-[13px] leading-none text-ink-400 line-through">
                              {money(producto.compareAtPrice)}
                            </p>
                          ) : null}
                        </div>
                        {/* Acá antes decía "6 cuotas sin interés". No hay cuotas
                            en el sitio original, así que no se anuncia nada. */}
                      </div>

                      <div className={`mt-4 flex items-center gap-2${enterClass}`} style={enterStyle(420)}>
                        <Link
                          href={`/producto/${producto.slug}`}
                          className="min-w-0 flex-1 rounded-full bg-ink-900 px-4 py-2.5 text-center text-[13px] font-extrabold text-white transition hover:bg-ink-800"
                        >
                          Ver este equipo
                        </Link>
                        <button
                          type="button"
                          onClick={agregar}
                          disabled={sinStock}
                          aria-label={sinStock ? `${producto.name} sin stock` : `Agregar ${producto.name} al carrito`}
                          className="shrink-0 rounded-full bg-brand-500 px-4 py-2.5 text-[13px] font-extrabold text-deep transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-ink-100 disabled:text-ink-500"
                        >
                          {sinStock ? "Sin stock" : "Agregar"}
                        </button>
                      </div>
                    </article>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Espacio al pie del hero, sobre el que se apoya el cintillo de
          confianza (lo pisa 24-32 px). Fondo liso, sin degradé: el usuario
          lo pidió con el corte recto. */}
      <div aria-hidden className="h-16 shrink-0 sm:h-20 lg:h-16" />

      {count > 1 ? (
        <>
          {/* Flechas a los costados, sin relleno ni contorno: solo el ícono
              con sombra, para que se lean sobre el fondo oscuro y también si
              caen sobre la tarjeta blanca. En móvil se usa swipe. Sin puntos
              de avance: el usuario los pidió fuera. */}
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Diapositiva anterior"
            className="group absolute left-0.5 top-1/2 z-10 hidden h-12 w-8 -translate-y-1/2 place-items-center rounded-lg bg-transparent text-white/85 transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-400 active:scale-95 sm:grid min-[1440px]:left-6 min-[1440px]:w-12"
          >
            <ChevronLeft size={30} strokeWidth={2} aria-hidden className="drop-shadow-[0_1px_3px_rgba(0,0,0,0.55)] transition-transform group-hover:-translate-x-0.5" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Diapositiva siguiente"
            className="group absolute right-0.5 top-1/2 z-10 hidden h-12 w-8 -translate-y-1/2 place-items-center rounded-lg bg-transparent text-white/85 transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-400 active:scale-95 sm:grid min-[1440px]:right-6 min-[1440px]:w-12"
          >
            <ChevronRight size={30} strokeWidth={2} aria-hidden className="drop-shadow-[0_1px_3px_rgba(0,0,0,0.55)] transition-transform group-hover:translate-x-0.5" />
          </button>
        </>
      ) : null}
    </section>
  );
}