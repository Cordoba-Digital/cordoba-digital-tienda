"use client";

import { useEffect } from "react";
import type Lenis from "lenis";

export function SmoothScroll() {
  useEffect(() => {
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      window.matchMedia("(pointer: coarse)").matches ||
      "ontouchstart" in window
    ) {
      return;
    }

    // Lenis se baja recién acá: en celulares y pantallas táctiles no se usa,
    // así que no tiene por qué viajar en el JS de todas las páginas.
    let lenis: Lenis | null = null;
    let frame = 0;
    let cancelled = false;
    import("lenis").then(({ default: LenisClass }) => {
      if (cancelled) return;
      lenis = new LenisClass({
        duration: 1.1,
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 1.2,
        syncTouch: true,
        allowNestedScroll: true,
      });
      const raf = (time: number) => {
        lenis?.raf(time);
        frame = requestAnimationFrame(raf);
      };
      frame = requestAnimationFrame(raf);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      lenis?.destroy();
    };
  }, []);

  return null;
}
