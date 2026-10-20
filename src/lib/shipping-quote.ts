"use client";

import { useEffect, useState } from "react";

import type { ShippingOption } from "@/lib/shipping";

export type ShippingQuote = {
  zone: string;
  options: ShippingOption[];
};

type QuoteItem = { slug: string; quantity: number };

export async function fetchShippingQuote(args: { zip: string; items?: QuoteItem[]; signal?: AbortSignal }): Promise<ShippingQuote> {
  const res = await fetch("/api/shipping", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ zip: args.zip.replace(/\D/g, "").slice(0, 4), items: args.items ?? [] }),
    signal: args.signal,
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? "No pudimos calcular el envío.");
  }
  return { zone: data.zone, options: data.options };
}

/**
 * Cotiza el envío para el CP y los ítems del carrito. Si el CP o los ítems
 * cambian mientras una consulta está en vuelo, esa consulta se aborta: no
 * pisa el resultado nuevo ni le suma una llamada a Andreani al límite por IP.
 */
export function useShippingQuote(args: { zip: string; items: QuoteItem[] }) {
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [zone, setZone] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Clave estable: el array de ítems cambia de identidad en cada render.
  const itemsKey = JSON.stringify(args.items.map((i) => ({ slug: i.slug, quantity: i.quantity })));

  useEffect(() => {
    const zip = args.zip.replace(/\D/g, "").slice(0, 4);
    const controller = new AbortController();
    const id = window.setTimeout(
      async () => {
        // CP incompleto: sin opciones y sin "Calculando envíos...". Antes, si
        // se borraba un dígito con una consulta en vuelo, el spinner quedaba
        // girando porque nadie apagaba `loading`.
        if (zip.length !== 4) {
          setOptions([]);
          setZone(null);
          setError(null);
          setLoading(false);
          return;
        }
        setLoading(true);
        setError(null);
        try {
          const quote = await fetchShippingQuote({ zip, items: JSON.parse(itemsKey) as QuoteItem[], signal: controller.signal });
          setOptions(quote.options);
          setZone(quote.zone);
        } catch (error) {
          if (controller.signal.aborted) return;
          setOptions([]);
          setZone(null);
          setError(error instanceof Error ? error.message : "No pudimos calcular el envío.");
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      },
      zip.length === 4 ? 350 : 0,
    );

    return () => {
      controller.abort();
      window.clearTimeout(id);
    };
  }, [args.zip, itemsKey]);

  return { options, zone, loading, error };
}

export type SucursalOpcion = { codigo: string; nombre: string; direccion: string; localidad: string; horario: string };

/** Sucursales de Andreani para el CP. Lista vacía si no hay o no se pudo consultar. */
export function useSucursales(zip: string) {
  const [sucursales, setSucursales] = useState<SucursalOpcion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cp = zip.replace(/\D/g, "").slice(0, 4);
    const controller = new AbortController();
    const id = window.setTimeout(async () => {
      if (cp.length !== 4) {
        // Sin esto, el select quedaba en "Buscando sucursales..." si el CP
        // cambiaba con una consulta en vuelo.
        setSucursales([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/shipping/sucursales?cp=${cp}`, { signal: controller.signal });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; sucursales?: SucursalOpcion[] };
        setSucursales(res.ok && data.ok ? (data.sucursales ?? []) : []);
      } catch {
        if (!controller.signal.aborted) setSucursales([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, cp.length === 4 ? 350 : 0);
    return () => {
      controller.abort();
      window.clearTimeout(id);
    };
  }, [zip]);

  return { sucursales, loading };
}
