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
// Igual que `duration-300` de la pista.
const SLIDE_MS = 300;

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const { addItem } = useStore();
  const count = slides.length;
  // Loop continuo: la pista lleva una copia del último aviso al principio y
  // una del primero al final. `pos` es la posición en esa pista (1 = primer
  // aviso real). Al llegar a una copia se salta sin transición al aviso real
  // equivalente, así del último se pasa al primero sin recorrer los demás.
  const loop = slides.length > 1;
  const [pos, setPos] = useState(loop ? 1 : 0);
  const [animate, setAnimate] = useState(true);
  // Tras el salto, el aviso real ya se ve en su estado final: sin esto
  // repetiría la entrada que ya hizo la copia y parpadearía. Arranca en
  // `true`: el primer slide se ve de entrada, sin el fundido desde opacidad 0,
  // que demoraba el LCP (el navegador no cuenta un elemento invisible).
  const [skipEnter, setSkipEnter] = useState(true);
  const jumping = useRef(false);
  const index = loop ? (pos - 1 + count) % count : 0;
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

  const go = useCallback(
    (delta: number) => {
      if (count < 2 || jumping.current) return;
      setSkipEnter(false);
      setPos((p) => Math.min(count + 1, Math.max(0, p + delta)));
    },
    [count],
  );

  // Parado sobre una copia: cuando termina el deslizamiento se salta al aviso
  // real sin transición. Con un timer y no con `transitionend`, que no llega
  // con movimiento reducido ni si la pestaña quedó en segundo plano.
  useEffect(() => {
    if (!loop || (pos !== 0 && pos !== count + 1)) return;
    jumping.current = true;
    const timer = window.setTimeout(() => {
      setAnimate(false);
      setSkipEnter(true);
      setPos(pos === 0 ? count : 1);
    }, SLIDE_MS + 20);
    return () => window.clearTimeout(timer);
  }, [pos, count, loop]);

  // Vuelve a activar la transición dos cuadros después del salto, cuando el
  // navegador ya pintó la pista en la posición nueva.
  useEffect(() => {
    if (animate) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        jumping.current = false;
        setAnimate(true);
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [animate]);

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

  // Avance automático. `index` en las dependencias reinicia el ciclo con cada
  // cambio, también el manual. El salto desde una copia no cambia `index`, así
  // que no corta la cuenta.
  useEffect(() => {
    if (paused || count < 2) return;
    const timer = setInterval(() => go(1), INTERVAL_MS);
    return () => clearInterval(timer);
  }, [paused, count, index, go]);

  const real = slides.map((slide, i) => ({ slide, i, clone: false, key: slide.id, at: loop ? i + 1 : i }));
  const track = loop
    ? [
        { slide: slides[count - 1], i: count - 1, clone: true, key: "copia-inicio", at: 0 },
        ...real,
        { slide: slides[0], i: 0, clone: true, key: "copia-fin", at: count + 1 },
      ]
    : real;

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="relative overflow-hidden lg:flex lg:h-[clamp(25rem,calc(100svh-var(--hero-top,150px)-88px),40rem)] lg:flex-col"
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
        className={`flex lg:min-h-0 lg:flex-1 ${animate ? "transition-transform duration-300 ease-out motion-reduce:transition-none" : ""}`}
        style={{ transform: `translateX(-${pos * 100}%)` }}
      >
        {track.map(({ slide, i, clone, key, at }) => {
          // Una copia solo está activa mientras se ve, durante el salto.
          const active = at === pos;
          // Entrada escalonada solo del slide activo: fade + rise (solo
          // transform/opacity, sin layout) con keyframes propios `hero-enter`.
          // Sin `key` ni remontajes: las fotos persisten y no reflashean.
          const enter = active && !reduceMotion && !skipEnter;
          const enterClass = enter ? " animate-hero-enter motion-reduce:animate-none" : "";
          const enterStyle = (ms: number) => (enter ? { animationDelay: `${ms}ms` } : undefined);
          // Un solo `h1` en toda la home: el del primer slide. El resto usa el
          // mismo estilo en un `p` para no romper la jerarquía de títulos.
          const Title = i === 0 && !clone ? "h1" : "p";
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
              key={key}
              role="group"
              aria-roledescription="diapositiva"
              aria-label={`${i + 1} de ${count}`}
              aria-hidden={clone || !active}
              inert={clone || !active}
              className="w-full shrink-0 lg:h-full"
            >
              {/* En el celular la portada es un banner bajo: título y botón a la
                  izquierda y el producto chico a la derecha, para que debajo
                  entren los accesos y las categorías sin scrollear. */}
              <div
                className={`container-xl relative grid items-center gap-3 pb-2 pt-4 sm:gap-8 sm:pb-4 sm:pt-9 lg:h-full lg:pb-0 lg:pt-6 ${
                  producto
                    ? "grid-cols-[minmax(0,1fr)_8.5rem] sm:grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]"
                    : "lg:max-w-3xl"
                }`}
              >
                <div>
                  <span className={`hidden items-center gap-2 rounded-full border border-brand-200 bg-white/70 px-3 py-1 text-[11px] font-semibold text-ink-700 backdrop-blur sm:inline-flex${enterClass}`} style={enterStyle(0)}>
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden />
                    {slide.pill}
                  </span>
                  <Title className={`text-balance-pretty text-[1.3rem] font-black leading-[1.12] tracking-tight text-ink-900 sm:mt-3.5 sm:text-4xl sm:leading-[1.08] lg:text-[2.6rem]${enterClass}`} style={enterStyle(70)}>
                    {slide.titleLead}{" "}
                    {/* Naranja sólido, no degradado: `brand-700` da más de 4,5:1
                        sobre el crema del hero. */}
                    <span className="text-brand-700">{slide.titleAccent}</span>
                  </Title>
                  <p className={`mt-3.5 hidden max-w-xl text-[15px] leading-relaxed text-ink-600 sm:block${enterClass}`} style={enterStyle(140)}>{slide.text}</p>
                  {/* Botones píldora. El naranja de marca lleva la etiqueta en
                      tinta oscura y no en blanco: `brand-500` es un naranja
                      claro y con blanco da 3,37:1, que no pasa los 4,5:1 de
                      WCAG AA para texto chico. Sobre tinta da 5,36:1. */}
                  <div className={`mt-3 flex flex-wrap gap-2.5 sm:mt-5${enterClass}`} style={enterStyle(210)}>
                    <Link
                      href={slide.cta.href}
                      className="rounded-full bg-brand-500 px-4 py-2 text-[13px] font-extrabold text-deep transition hover:bg-brand-400 sm:px-5 sm:py-3 sm:text-sm"
                    >
                      {slide.cta.label}
                    </Link>
                    {slide.cta2 ? (
                      <Link
                        href={slide.cta2.href}
                        className="hidden rounded-full border border-ink-200 bg-white/60 px-5 py-3 text-sm font-bold text-ink-900 transition hover:bg-white sm:inline-block"
                      >
                        {slide.cta2.label}
                      </Link>
                    ) : null}
                  </div>
                  <dl className={`mt-6 hidden max-w-xl gap-2.5 sm:grid ${statsCols}`}>
                    {slide.stats.map((stat) => (
                      <div key={stat.v} className={`rounded-2xl border border-brand-100 bg-white/70 px-3 py-2.5 backdrop-blur${enterClass}`} style={enterStyle(280)}>
                        <dt className="text-base font-black leading-none text-ink-900">{stat.k}</dt>
                        <dd className="mt-1 text-[10px] font-medium uppercase tracking-wide text-ink-500">{stat.v}</dd>
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
                    <article className="relative rounded-2xl bg-surface p-2 shadow-[0_28px_70px_-34px_rgba(194,65,12,0.35)] ring-1 ring-black/5 sm:rounded-[28px] sm:p-5 lg:flex lg:h-full lg:flex-col">
                      {off > 0 ? (
                        <span className="absolute left-2 top-2 z-10 rounded-md bg-rose-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white sm:hidden">
                          {off}% OFF
                        </span>
                      ) : null}
                      <div className="hidden items-center justify-between gap-3 sm:flex">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-deep px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                          <Truck size={12} strokeWidth={2.4} aria-hidden />
                          Envío Andreani
                        </span>
                        {off > 0 ? (
                          <span className="text-[13px] font-extrabold text-rose-600">{off}% OFF</span>
                        ) : null}
                      </div>

                      {/* La foto también lleva a la ficha: en el celular no están los
                          botones y es lo primero que se toca. Fuera del orden
                          de tabulación porque el nombre ya es el mismo enlace. */}
                      <Link
                        href={`/producto/${producto.slug}`}
                        tabIndex={-1}
                        aria-hidden
                        className="block overflow-hidden rounded-xl bg-white sm:mt-3 sm:rounded-2xl lg:min-h-0 lg:flex-1"
                      >
                        <div className="aspect-[5/4] p-1.5 sm:aspect-[16/10] sm:p-4 lg:aspect-auto lg:h-full lg:p-3">
                          <ProductImg
                            src={producto.image}
                            srcSet={producto.srcSet}
                            alt={producto.name}
                            sizes="(max-width: 639px) 136px, (max-width: 1023px) 100vw, 40vw"
                            width={800}
                            height={500}
                            priority={i === 0 && !clone}
                            className="h-full w-full object-contain"
                          />
                        </div>
                      </Link>

                      <div className="mt-1.5 px-0.5 sm:mt-3.5 sm:px-0">
                        {producto.brand && producto.brand !== "General" ? (
                          <p className="hidden text-[10px] uppercase tracking-[0.14em] text-ink-400 sm:block">{producto.brand}</p>
                        ) : null}
                        <Link
                          href={`/producto/${producto.slug}`}
                          className={`block line-clamp-2 text-[11.5px] font-semibold leading-snug text-ink-900 hover:text-brand-700 sm:mt-1 sm:text-[15px] sm:font-bold${enterClass}`}
                          style={enterStyle(350)}
                        >
                          {producto.name}
                        </Link>
                        <div className={`mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 sm:mt-2${enterClass}`} style={enterStyle(350)}>
                          <p className="text-[14px] font-extrabold leading-none tracking-tight text-ink-900 sm:text-[17px]">
                            {money(producto.price)}
                          </p>
                          {producto.compareAtPrice ? (
                            <p className="hidden text-[13px] leading-none text-ink-400 line-through sm:block">
                              {money(producto.compareAtPrice)}
                            </p>
                          ) : null}
                        </div>
                        {/* Acá antes decía "6 cuotas sin interés". No hay cuotas
                            en el sitio original, así que no se anuncia nada. */}
                      </div>

                      <div className={`mt-4 hidden items-center gap-2 sm:flex${enterClass}`} style={enterStyle(420)}>
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
      <div aria-hidden className="h-3 shrink-0 sm:h-20 lg:h-16" />

      {count > 1 ? (
        <>
          {/* Flechas a los costados, sin relleno ni contorno: solo el ícono
              con sombra, para que se lean sobre el fondo crema y también si
              caen sobre la tarjeta blanca. En móvil se usa swipe. Sin puntos
              de avance: el usuario los pidió fuera. */}
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Diapositiva anterior"
            className="group absolute left-0.5 top-1/2 z-10 hidden h-12 w-8 -translate-y-1/2 place-items-center rounded-lg bg-transparent text-ink-700 transition hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-400 active:scale-95 sm:grid min-[1440px]:left-6 min-[1440px]:w-12"
          >
            <ChevronLeft size={30} strokeWidth={2} aria-hidden className="drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)] transition-transform group-hover:-translate-x-0.5" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Diapositiva siguiente"
            className="group absolute right-0.5 top-1/2 z-10 hidden h-12 w-8 -translate-y-1/2 place-items-center rounded-lg bg-transparent text-ink-700 transition hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-400 active:scale-95 sm:grid min-[1440px]:right-6 min-[1440px]:w-12"
          >
            <ChevronRight size={30} strokeWidth={2} aria-hidden className="drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)] transition-transform group-hover:translate-x-0.5" />
          </button>
        </>
      ) : null}
    </section>
  );
}