"use client";

import { useId, useState } from "react";

/**
 * Acordeón de preguntas frecuentes, con apertura animada.
 *
 * Antes era un `<details>` nativo y la respuesta aparecía de un salto.
 *
 * Por qué no sigue siendo `<details>`: se midió en el navegador y la animación
 * NO funciona adentro. La técnica de `grid-template-rows` de `0fr` a `1fr` solo
 * se interpola si el navegador tiene el contenido dibujado, y `<details>`
 * cerrado lo esconde por abajo (`::details-content`), así que no hay estado
 * intermedio: la altura salta de 33 a 33. La misma técnica sobre un `div`
 * normal interpola bien (0 → 2 → 14 → 23 → 31 → 33).
 *
 * Qué se pierde y por qué se acepta: sin JavaScript las respuestas quedan
 * cerradas. Es el mismo criterio que usan Radix y Headless UI, y este sitio ya
 * depende de JS para el carrito, los filtros y el tema. El texto sigue en el
 * HTML del servidor, así que los buscadores lo leen igual.
 *
 * La animación va por `grid-template-rows`, que no necesita medir el texto en
 * JavaScript, y respeta `prefers-reduced-motion`.
 */

export type FaqItem = {
  q: string;
  a: string;
};

export function FaqAccordion({ items, variant = "tarjeta" }: { items: FaqItem[]; variant?: "tarjeta" | "plano" }) {
  const base = useId();
  // Varias respuestas pueden estar abiertas a la vez, como antes.
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({});

  const alternar = (clave: string) =>
    setAbiertas((prev) => ({ ...prev, [clave]: !prev[clave] }));

  // `plano` es la lista undivided que va dentro de una tarjeta sola (la home):
  // cada pregunta se separa con una línea en vez de ser una tarjeta propia, para
  // no meter una caja dentro de otra.
  if (variant === "plano") {
    return (
      <div>
        {items.map((item, i) => {
          const idPanel = `${base}-panel-${i}`;
          const idBoton = `${base}-boton-${i}`;
          const abierta = abiertas[item.q] ?? false;
          return (
            <div key={item.q} className="border-b border-ink-100 last:border-b-0">
              <h3 className="m-0">
                <button
                  type="button"
                  id={idBoton}
                  aria-expanded={abierta}
                  aria-controls={idPanel}
                  onClick={() => alternar(item.q)}
                  className="flex w-full cursor-pointer items-center justify-between gap-4 py-4 text-left text-[15px] font-bold text-ink-900 hover:text-brand-700"
                >
                  {item.q}
                  <span
                    aria-hidden
                    className="shrink-0 text-ink-400 transition-transform duration-300 ease-out data-[abierto=si]:rotate-180 motion-reduce:transition-none"
                    data-abierto={abierta ? "si" : "no"}
                  >
                    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                </button>
              </h3>
              <div
                id={idPanel}
                role="region"
                aria-labelledby={idBoton}
                className="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none"
                style={{ gridTemplateRows: abierta ? "1fr" : "0fr" }}
              >
                <div className="min-h-0 overflow-hidden">
                  <p className="pb-4 text-sm leading-relaxed text-ink-500">{item.a}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    // El `space-y-3` va acá adentro y no en el que llama: cuando lo tenía el
    // call site, basta con un refactor para que las tarjetas queden pegadas
    // (0px de separación) sin que se note en el build. Se midió en producción:
    // la home mostraba 0 y el centro de ayuda 12.
    <div className="space-y-3">
      {items.map((item, i) => {
        const idPanel = `${base}-panel-${i}`;
        const idBoton = `${base}-boton-${i}`;
        const abierta = abiertas[item.q] ?? false;

        return (
          <div key={item.q} className="card-surface">
            <h3 className="m-0">
              <button
                type="button"
                id={idBoton}
                aria-expanded={abierta}
                aria-controls={idPanel}
                onClick={() => alternar(item.q)}
                className="flex w-full cursor-pointer items-center justify-between gap-4 p-4 text-left text-sm font-bold text-ink-900"
              >
                {item.q}
                <span
                  aria-hidden
                  // ink-300 daba 2,19:1 sobre la card blanca y el "+" casi no
                  // se veía. ink-500 pasa AA con holgura.
                  className="text-lg leading-none text-ink-500 transition-transform duration-300 ease-out data-[abierto=si]:rotate-45 motion-reduce:transition-none"
                  data-abierto={abierta ? "si" : "no"}
                >
                  +
                </span>
              </button>
            </h3>
            <div
              id={idPanel}
              role="region"
              aria-labelledby={idBoton}
              className="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none"
              style={{ gridTemplateRows: abierta ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden min-h-0">
                <p className="px-4 pb-4 text-sm leading-relaxed text-ink-600">{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
