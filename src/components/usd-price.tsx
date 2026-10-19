"use client";

import { createContext, useContext, type ReactNode } from "react";

import { usdFor } from "@/lib/usdt-amount";

/**
 * Cotización de la tienda (pesos por dólar) que carga el dueño en Admin →
 * Medios de pago. Llega una sola vez desde el layout, como las cuotas, y las
 * tarjetas y la ficha la leen de acá. Es la misma con la que el checkout cobra
 * en USDT, así que el "USD N" que ve el cliente coincide con lo que paga.
 * Sin cotización cargada no se muestra nada.
 */
const UsdRateContext = createContext<number | null>(null);

export function UsdRateProvider({ rate, children }: { rate: number | null; children: ReactNode }) {
  return <UsdRateContext.Provider value={rate}>{children}</UsdRateContext.Provider>;
}

const usdFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

/** "USD 960" debajo del precio, como en la web anterior. */
export function UsdLine({ price, className }: { price: number; className?: string }) {
  const usd = usdFor(price, useContext(UsdRateContext));
  if (usd === null) return null;
  return <p className={className ?? "text-[12px] font-semibold text-ink-500"}>USD {usdFormatter.format(usd)}</p>;
}
