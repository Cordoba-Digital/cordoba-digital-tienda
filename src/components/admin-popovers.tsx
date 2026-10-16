"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const OPEN = "details[data-popover][open]";

/**
 * Los menús desplegables del panel (`<details data-popover>`: período, avisos)
 * se cierran como cualquier menú: con un clic afuera, con Escape (el foco vuelve
 * al botón) y al elegir una opción que cambia de página.
 */
export function AdminPopovers() {
  const pathname = usePathname();
  const search = useSearchParams();

  useEffect(() => {
    document.querySelectorAll<HTMLDetailsElement>(OPEN).forEach((d) => (d.open = false));
  }, [pathname, search]);

  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      document.querySelectorAll<HTMLDetailsElement>(OPEN).forEach((d) => {
        if (!d.contains(e.target as Node)) d.open = false;
      });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      document.querySelectorAll<HTMLDetailsElement>(OPEN).forEach((d) => {
        d.open = false;
        d.querySelector("summary")?.focus();
      });
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return null;
}
