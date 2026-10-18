"use client";

import { useEffect } from "react";
import Lenis from "lenis";

let current: Lenis | null = null;

/**
 * La instancia activa, para mover la página desde código. Con Lenis andando,
 * un `scrollIntoView` nativo puede quedar pisado por el scroll suave que
 * Lenis todavía está animando.
 */
export function getLenis(): Lenis | null {
  return current;
}

export function SmoothScroll() {
  useEffect(() => {
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      window.matchMedia("(pointer: coarse)").matches ||
      "ontouchstart" in window
    ) {
      return;
    }

    const lenis = new Lenis({
      duration: 1.1,
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.2,
      syncTouch: true,
      allowNestedScroll: true,
    });
    current = lenis;

    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
      current = null;
    };
  }, []);

  return null;
}
