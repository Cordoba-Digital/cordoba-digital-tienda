"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { CategoryIcon } from "@/components/category-icon";

/** Una categoría raíz con su conteo real de la base, ya lista para pintar. */
export type CategoryRowItem = { name: string; href: string; count: number };

/** Cuánto se mueve la tira por clic de flecha: casi cuatro tiles y medio. */
const PASO = 420;

/**
 * Relleno mínimo de la barra, en porcentaje.
 *
 * Sin esto la barra arranca invisible en el extremo inicial y parece un detalle
 * roto en vez de un indicador. Con el mínimo se ve siempre un trocito.
 */
const AVANCE_MINIMO = 12;

/**
 * Fila desplazable de categorías, con flechas y barra de avance.
 *
 * El mecanismo de desplazamiento es el nativo y no se toca: la tira scrolpea
 * con panel táctil, rueda y teclado, y las flechas son un atajo que la mueve por
 * pasos. No es un carrusel con transformación porque eso rompe el arrastre con
 * el dedo, que en el celular es como se usa esta fila.
 *
 * La barra y el estado de las flechas salen de la posición real del scroll, con
 * `requestAnimationFrame` para no repintar en cada píxel de desplazamiento
 * (ver el comentario del efecto).
 */
export function CategoryRow({ items, label }: { items: CategoryRowItem[]; label: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  // Entero de 0 a 100. Si no hay desborde vale 100, que es el mismo estado que
  // "estamos al final", así que con un solo número se gobiernan la barra y las
  // dos flechas.
  const [avance, setAvance] = useState(0);
  // Si la tira no tiene desborde no hay nada que recorrer: las dos flechas se
  // apagan. Va aparte del porcentaje porque con el desborde ausente el avance
  // vale 100 (barra llena), y con ese valor solo no se distingue "estamos al
  // final" de "no hay nada que ver".
  const [desborde, setDesborde] = useState(true);

  useEffect(() => {
    const tira = ref.current;
    if (!tira) return;

    let cuadro = 0;
    // Porcentaje recién calculado, que todavía no se pintó.
    let pendiente = 0;
    let pendienteDesborde = true;
    // Último valor que llegó al estado, para no pedir un repintado si no cambió
    // (el scroll suave dispara decenas de eventos por cuadro).
    let pintado = -1;
    let pintadoDesborde = true;

    const leer = () => {
      const max = tira.scrollWidth - tira.clientWidth;
      pendienteDesborde = max > 1;
      // Sin desborde no hay recorrido: la barra va llena.
      if (max <= 0) return 100;
      return Math.round((tira.scrollLeft / max) * 100);
    };

    const pintar = () => {
      cuadro = 0;
      if (pendiente !== pintado) {
        pintado = pendiente;
        setAvance(pendiente);
      }
      if (pendienteDesborde !== pintadoDesborde) {
        pintadoDesborde = pendienteDesborde;
        setDesborde(pendienteDesborde);
      }
    };

    const medir = () => {
      pendiente = leer();
      if (!cuadro) cuadro = requestAnimationFrame(pintar);
    };

    // Al montar se lee la posición real (por ejemplo si el navegador la restauró
    // o si la ventana ya venía scrolleada) para que la barra no aparezca en 0
    // hasta el primer scroll.
    pendiente = leer();
    pendienteDesborde = tira.scrollWidth - tira.clientWidth > 1;
    pintado = pendiente;
    pintadoDesborde = pendienteDesborde;
    setAvance(pendiente);
    setDesborde(pendienteDesborde);

    // Pasivo: el listener no llama a `preventDefault`, así que no hace falta
    // esperar al navegador para responder.
    tira.addEventListener("scroll", medir, { passive: true });
    // Al redimensionar cambia el desborde y con él el porcentaje.
    window.addEventListener("resize", medir);

    return () => {
      tira.removeEventListener("scroll", medir);
      window.removeEventListener("resize", medir);
      if (cuadro) cancelAnimationFrame(cuadro);
    };
  }, []);

  const mover = (dir: -1 | 1) => ref.current?.scrollBy({ left: dir * PASO, behavior: "smooth" });
  // Sin desborde no hay a qué ir en ninguna dirección, así que las dos flechas
  // se apagan juntas.
  const enInicio = !desborde || avance <= 0;
  const enFinal = !desborde || avance >= 100;

  return (
    <div>
      <div className="relative">
        <div ref={ref} className="no-scrollbar flex gap-2 overflow-x-auto pb-3">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex w-[108px] shrink-0 flex-col items-center gap-2 rounded-2xl px-1 py-2"
            >
              <span className="grid h-[68px] w-[68px] place-items-center rounded-2xl bg-surface text-brand-700 shadow-sm ring-1 ring-black/5 transition group-hover:-translate-y-0.5 group-hover:ring-brand-400">
                <CategoryIcon name={item.name} className="h-[26px] w-[26px]" />
              </span>
              <span className="line-clamp-2 min-h-8 text-center text-[12px] font-semibold leading-tight text-ink-900">
                {item.name}
              </span>
              <span className="tabular-nums text-[11px] text-ink-400">{item.count}</span>
            </Link>
          ))}
        </div>

        {/*
          Las flechas son un atajo, no el mecanismo: la tira scrolpea igual con
          el dedo, la rueda y el teclado. En el extremo se apagan, para que se
          lea "no hay más para este lado" y no "el botón está roto".
        */}
        <button
          type="button"
          onClick={() => mover(-1)}
          disabled={enInicio}
          aria-label={`Anterior en ${label}`}
          className={`absolute -left-3 top-5 hidden h-9 w-9 place-items-center rounded-full border border-ink-100 bg-surface text-ink-700 shadow-md transition hover:bg-brand-50 hover:text-brand-700 md:grid ${
            enInicio ? "pointer-events-none opacity-40" : ""
          }`}
        >
          <ChevronLeft size={17} strokeWidth={2.2} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => mover(1)}
          disabled={enFinal}
          aria-label={`Siguiente en ${label}`}
          className={`absolute -right-3 top-5 hidden h-9 w-9 place-items-center rounded-full border border-ink-100 bg-surface text-ink-700 shadow-md transition hover:bg-brand-50 hover:text-brand-700 md:grid ${
            enFinal ? "pointer-events-none opacity-40" : ""
          }`}
        >
          <ChevronRight size={17} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>

      {/*
        Barra de avance: decorativa, porque la posición real ya la dice el
        scroll y los lectores de pantalla no necesitan un porcentaje que cambia
        en cada gesto.
      */}
      <div className="mt-1 flex justify-center">
        <div className="h-1 w-28 overflow-hidden rounded-full bg-ink-200" aria-hidden="true">
          <div
            className="h-full rounded-full bg-brand-500"
            style={{ width: `${Math.max(AVANCE_MINIMO, avance)}%` }}
          />
        </div>
      </div>
    </div>
  );
}