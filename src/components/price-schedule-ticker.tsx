"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const KEY = "ofertas-tick";
const EVERY_MS = 60_000;
/** Más lejos que esto no se espera con la página abierta: el próximo pedido de página vuelve a preguntar. */
const MAX_WAIT_MS = 60 * 60_000;

type Saved = { at: number; next: string | null };

function read(): Saved | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null") as Saved | null;
  } catch {
    return null;
  }
}

function save(value: Saved): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {}
}

let pending: Promise<string | null> | null = null;

/** Un solo pedido a la vez por pestaña, aunque el efecto corra dos veces seguidas. */
function tick(): Promise<string | null> {
  pending ??= fetch("/api/ofertas/tick", { method: "POST" })
    .then((res) => res.json() as Promise<{ next?: string | null }>)
    .then((data) => {
      const next = data.next ?? null;
      save({ at: Date.now(), next });
      return next;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

/**
 * Ofertas programadas a hora exacta (ver `price-schedules.ts`). Con la tienda
 * abierta, le pide al servidor que aplique lo que corresponda (una vez por
 * minuto como mucho, entre todas las pestañas) y, si algo empieza o termina
 * dentro de la próxima hora, vuelve a pedir justo en ese segundo y recarga
 * los precios de la página.
 */
export function PriceScheduleTicker() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let timer: number | undefined;
    let cancelled = false;

    function schedule(next: string | null) {
      if (!next || cancelled) return;
      const wait = new Date(next).getTime() - Date.now();
      if (wait > MAX_WAIT_MS) return;
      timer = window.setTimeout(async () => {
        const after = await tick().catch(() => null);
        router.refresh();
        // Si el servidor sigue dando la misma hora (no pudo aplicarla), no se insiste.
        if (after !== next) schedule(after);
      }, Math.max(0, wait) + 1_000);
    }

    // Otra pestaña (o esta, en la página anterior) preguntó hace menos de un
    // minuto: alcanza con lo que respondió.
    const saved = read();
    if (saved && Date.now() - saved.at < EVERY_MS) {
      schedule(saved.next);
    } else {
      tick()
        .then(schedule)
        .catch(() => {});
    }

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [router, pathname]);

  return null;
}
