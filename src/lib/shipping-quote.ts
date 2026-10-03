"use client";

import { useEffect, useState } from "react";

import type { ShippingOption } from "@/lib/shipping";

export type ShippingQuote = {
  zone: string;
  options: ShippingOption[];
};

export async function fetchShippingQuote(args: { zip: string; subtotal: number }): Promise<ShippingQuote> {
  const res = await fetch("/api/shipping", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ zip: args.zip.replace(/\D/g, "").slice(0, 4), subtotal: args.subtotal }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? "No pudimos calcular el envío.");
  }
  return { zone: data.zone, options: data.options };
}

export function useShippingQuote(args: { zip: string; subtotal: number }) {
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [zone, setZone] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        const quote = await fetchShippingQuote({ zip, subtotal: args.subtotal });
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
  }, [args.zip, args.subtotal]);

  return { options, zone, loading, error };
}
