"use client";

import { useEffect, useState } from "react";

import type { ShippingOption } from "@/lib/shipping";

export type ShippingQuote = {
  zone: string;
  options: ShippingOption[];
};

type QuoteItem = { slug: string; quantity: number };

export async function fetchShippingQuote(args: { zip: string; subtotal: number; items?: QuoteItem[] }): Promise<ShippingQuote> {
  const res = await fetch("/api/shipping", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ zip: args.zip.replace(/\D/g, "").slice(0, 4), subtotal: args.subtotal, items: args.items ?? [] }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? "No pudimos calcular el envío.");
  }
  return { zone: data.zone, options: data.options };
}

export function useShippingQuote(args: { zip: string; subtotal: number; items: QuoteItem[] }) {
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [zone, setZone] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Clave estable: el array de ítems cambia de identidad en cada render.
  const itemsKey = JSON.stringify(args.items.map((i) => ({ slug: i.slug, quantity: i.quantity })));

  useEffect(() => {
    const zip = args.zip.replace(/\D/g, "").slice(0, 4);
    let cancelled = false;
    if (zip.length !== 4) {
      const id = window.setTimeout(() => {
        if (cancelled) return;
        setOptions([]);
        setZone(null);
        setError(null);
      }, 0);
      return () => {
        cancelled = true;
        window.clearTimeout(id);
      };
    }

    const id = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const quote = await fetchShippingQuote({ zip, subtotal: args.subtotal, items: JSON.parse(itemsKey) as QuoteItem[] });
        if (cancelled) return;
        setOptions(quote.options);
        setZone(quote.zone);
      } catch (error) {
        if (cancelled) return;
        setOptions([]);
        setZone(null);
        setError(error instanceof Error ? error.message : "No pudimos calcular el envío.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [args.zip, args.subtotal, itemsKey]);

  return { options, zone, loading, error };
}

export type SucursalOpcion = { codigo: string; nombre: string; direccion: string; localidad: string; horario: string };

/** Sucursales de Andreani para el CP. Lista vacía si no hay o no se pudo consultar. */
export function useSucursales(zip: string) {
  const [sucursales, setSucursales] = useState<SucursalOpcion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cp = zip.replace(/\D/g, "").slice(0, 4);
    let cancelled = false;
    const id = window.setTimeout(async () => {
      if (cp.length !== 4) {
        setSucursales([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/shipping/sucursales?cp=${cp}`);
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; sucursales?: SucursalOpcion[] };
        if (!cancelled) setSucursales(res.ok && data.ok ? (data.sucursales ?? []) : []);
      } catch {
        if (!cancelled) setSucursales([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [zip]);

  return { sucursales, loading };
}
