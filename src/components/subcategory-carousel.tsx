"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type SubcategoryLink = { id: string; name: string; path: string; count: number };

// Píxeles por segundo: lento, para que se puedan leer los nombres mientras pasan.
const SPEED = 32;
// Después de tocar o deslizar en el celular, cuánto espera para volver a moverse.
const RESUME_AFTER_TOUCH_MS = 2500;

/**
 * Botones de subcategorías en una sola fila que se desplazan solos y sin fin.
 * Se frena con el mouse encima, con foco de teclado o al tocar, y se puede
 * deslizar a mano. Si entran todos en el ancho, queda quieta.
 */
export function SubcategoryCarousel({ items, label }: { items: SubcategoryLink[]; label: string }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const firstSetRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const touchedUntil = useRef(0);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const firstSet = firstSetRef.current;
    if (!scroller || !firstSet) return;
    const measure = () => setOverflows(firstSet.scrollWidth > scroller.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    observer.observe(firstSet);
    return () => observer.disconnect();
  }, []);

  // No se apaga con "reducir movimiento" del sistema: Windows lo activa con solo
  // desactivar los efectos de animación, y la fila se frenaba sin que nadie lo
  // pidiera. Es lenta y se detiene con el mouse, el foco o al tocar.
  const animate = overflows;

  useEffect(() => {
    const scroller = scrollerRef.current;
    const firstSet = firstSetRef.current;
    if (!animate || !scroller || !firstSet) return;

    // La posición se lleva en un número con decimales: algunos navegadores
    // redondean scrollLeft y a esta velocidad el avance por cuadro es < 1px.
    let pos = scroller.scrollLeft;
    let last = performance.now();
    let frame = 0;
    // En celulares :hover queda pegado después de tocar, así que solo cuenta con mouse.
    const canHover = window.matchMedia("(hover: hover)");

    const tick = (now: number) => {
      const dt = Math.min(now - last, 100);
      last = now;
      const loop = firstSet.offsetWidth;
      const paused =
        (canHover.matches && scroller.matches(":hover")) ||
        scroller.matches(":focus-within") ||
        now < touchedUntil.current;
      if (paused) {
        pos = scroller.scrollLeft;
      } else if (loop > 0) {
        pos += (SPEED * dt) / 1000;
        if (pos >= loop) pos -= loop;
        scroller.scrollLeft = pos;
      }
      // Si el usuario deslizó hacia atrás más allá del inicio, lo pasa a la copia.
      if (scroller.scrollLeft <= 0 && paused && loop > 0) {
        scroller.scrollLeft = loop;
        pos = loop;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animate]);

  const holdForTouch = () => {
    touchedUntil.current = performance.now() + RESUME_AFTER_TOUCH_MS;
  };

  const renderSet = (copy: boolean) =>
    items.map((child) => (
      <Link
        key={`${copy ? "b" : "a"}-${child.id}`}
        href={`/categoria/${child.path}`}
        tabIndex={copy ? -1 : undefined}
        draggable={false}
        className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-ink-200 bg-surface px-3.5 py-1.5 text-sm font-semibold text-ink-700 transition hover:border-brand-300 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      >
        {child.name}
        <span className="text-[11px] font-normal text-ink-500">{child.count}</span>
      </Link>
    ));

  return (
    <nav aria-label={label} className="mb-6">
      <div
        ref={scrollerRef}
        className={`no-scrollbar flex overflow-x-auto py-1 ${
          animate
            ? "[mask-image:linear-gradient(to_right,transparent,#000_2.5rem,#000_calc(100%-2.5rem),transparent)]"
            : ""
        }`}
        onPointerDown={holdForTouch}
        onTouchStart={holdForTouch}
        onTouchMove={holdForTouch}
        onTouchEnd={holdForTouch}
        onWheel={holdForTouch}
      >
        <div ref={firstSetRef} className="flex shrink-0 gap-2 pr-2">
          {renderSet(false)}
        </div>
        {animate ? (
          <div className="flex shrink-0 gap-2 pr-2" aria-hidden="true">
            {renderSet(true)}
          </div>
        ) : null}
      </div>
    </nav>
  );
}
