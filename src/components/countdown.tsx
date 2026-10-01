"use client";

import { Fragment, useEffect, useState } from "react";

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

/**
 * Cuenta regresiva hasta el fin del dia (oferta relampago que se renueva sola).
 *
 * El componente aparece hoy en un solo lugar, el panel de ofertas del home, que
 * es oscuro. Igual se resuelve para los dos fondos porque el bloque es
 * reutilizable y porque el color de la rampa que sirve sobre papel no sirve
 * sobre el panel:
 *
 * - `tono="claro"` (por defecto): las cajitas de los digitos van con `bg-deep`,
 *   una caja oscura sobre fondo claro, y los dos puntos con `ink-600`. Sobre
 *   papel o tarjeta blanca `ink-600` da 9,9:1, asi que el separador se lee.
 * - `tono="oscuro"`: `deep` es exactamente el mismo color que el panel
 *   (`bg-ink` mide `#14161c`, y `--color-deep` tambien), asi que las cajitas se
 *   desvanecen en el fondo y el separador quedaba en 2,25:1. Por eso aqui las
 *   cajitas pasan a `bg-white/10` (una caja apenas mas clara que el panel, con
 *   los digitos blancos encima) y los puntos a `white/60`, que sobre `#14161c`
 *   da 7,1:1.
 */
export function Countdown({
  label = "Termina en",
  tono = "claro",
}: {
  label?: string;
  tono?: "claro" | "oscuro";
}) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const oscuro = tono === "oscuro";

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      setRemaining(Math.max(0, end.getTime() - now.getTime()));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const hours = remaining === null ? 0 : Math.floor(remaining / 3_600_000);
  const minutes = remaining === null ? 0 : Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = remaining === null ? 0 : Math.floor((remaining % 60_000) / 1000);

  // La letra va debajo de cada cajita, como en la maqueta: `10 H 38 M 33 S`.
  // El tono de cada letra es el mismo que ya usa cada variante para el
  // separador, para que no aparezca un color nuevo que no sepa si pasa AA.
  const unidades = [
    { valor: hours, letra: "H" },
    { valor: minutes, letra: "M" },
    { valor: seconds, letra: "S" },
  ];

  return (
    <div className="flex items-center gap-2">
      <span
        className={
          oscuro
            ? "text-xs font-semibold uppercase tracking-wide text-white/70"
            : "text-xs font-semibold uppercase tracking-wide text-ink-600"
        }
      >
        {label}
      </span>
      <div className="flex items-start gap-1">
        {unidades.map((unidad, index) => (
          <Fragment key={unidad.letra}>
            <span className="flex flex-col items-center gap-1">
              <span
                className={
                  oscuro
                    ? "grid h-8 min-w-8 place-items-center rounded-lg bg-white/10 px-1.5 text-sm font-bold tabular-nums text-white"
                    : "grid h-8 min-w-8 place-items-center rounded-lg bg-deep px-1.5 text-sm font-bold tabular-nums text-white"
                }
              >
                {remaining === null ? "--" : pad(unidad.valor)}
              </span>
              <span
                aria-hidden
                className={`text-[9px] font-semibold uppercase tracking-[0.1em] ${
                  oscuro ? "text-white/60" : "text-ink-600"
                }`}
              >
                {unidad.letra}
              </span>
            </span>
            {index < 2 ? (
              // El separador va fuera de la columna y con `leading-8`: así su
              // caja de línea mide lo mismo que la cajita de los dígitos y los
              // dos puntos quedan centrados contra el número, no contra el
              // conjunto (que ahora incluye la letra de abajo).
              <span
                aria-hidden
                className={`-mt-0.5 font-bold leading-8 ${oscuro ? "text-white/60" : "text-ink-600"}`}
              >
                :
              </span>
            ) : null}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
