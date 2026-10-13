"use client";

import { useSyncExternalStore } from "react";

const KEY = "cd_admin_guia_producto_cerrada";

const STEPS: { title: string; text: string }[] = [
  {
    title: "Escribí el nombre completo",
    text: "Marca, modelo y variante, con las memorias así: “256 GB” y “8 GB RAM”. Ej.: Samsung Galaxy A56 5G 256 GB 8 GB RAM. Con el nombre completamos marca, modelo, memoria y RAM.",
  },
  {
    title: "Si ya vendés uno parecido, usalo de base",
    text: "Aparece debajo del nombre. Copia la categoría, las características y la descripción. Revisá que todo aplique a esta variante.",
  },
  {
    title: "Subí las fotos",
    text: "Arrastralas o pegalas con Ctrl+V. La primera es la principal: producto entero, fondo blanco, sin textos encima.",
  },
  {
    title: "Precio y stock",
    text: "Precio final en pesos, sin centavos. Si está en oferta, poné el precio de antes en “Precio anterior” y la tienda calcula el % de descuento. Con stock 0 se muestra “Sin stock”.",
  },
  {
    title: "Categoría",
    text: "La principal es donde aparece en el menú. Si también va en otra (por ejemplo, “Ofertas” o una marca), marcala en “También aparece en”.",
  },
  {
    title: "Descripción y características",
    text: "Descripción corta: una o dos frases con lo más importante (se ve arriba de la ficha y en Google). Destacados: de 4 a 6 frases cortas con datos. Características: usá los botones de abajo de la tabla.",
  },
  {
    title: "Antes de crear",
    text: "Mirá la tarjeta “Así se ve en la tienda”. No pongas cuotas, “envío gratis” ni “stock limitado” en los textos: esas cosas cambian y la ficha queda desactualizada.",
  },
];

// Respaldo en memoria por si el navegador no deja usar localStorage.
let closedInMemory = false;

function readClosed(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return closedInMemory;
  }
}

const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function toggle(next: boolean) {
  closedInMemory = !next;
  try {
    window.localStorage.setItem(KEY, next ? "0" : "1");
  } catch {
    /* no pasa nada */
  }
  listeners.forEach((l) => l());
}

/** Guía corta para dar de alta un producto. Recuerda si la cerraste (solo en este navegador). */
export function AdminProductGuide() {
  // En el servidor siempre abierta; en el navegador, lo que se eligió la última vez.
  const open = !useSyncExternalStore(subscribe, readClosed, () => false);

  return (
    <section className="rounded-lg border border-ink-100 bg-surface">
      <button
        type="button"
        onClick={() => toggle(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left"
      >
        <span>
          <span className="text-sm font-bold text-ink-900">Guía para cargar un producto</span>
          <span className="ml-2 text-xs text-ink-500">7 pasos, 2 minutos</span>
        </span>
        <span className="text-xs font-bold text-brand-700">{open ? "Ocultar" : "Ver guía"}</span>
      </button>
      {open ? (
        <ol className="grid gap-x-6 gap-y-3 border-t border-ink-100 px-5 py-4 sm:grid-cols-2">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink-900 text-[11px] font-bold text-white">{i + 1}</span>
              <div>
                <p className="text-sm font-semibold text-ink-900">{step.title}</p>
                <p className="text-xs leading-relaxed text-ink-600">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
