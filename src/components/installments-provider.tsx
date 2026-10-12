"use client";

import { createContext, useContext, type ReactNode } from "react";

import { money } from "@/lib/format";
import { bestInterestFree, installmentOptions, type InstallmentPlan } from "@/lib/installments";

/**
 * Los planes de cuotas llegan una sola vez desde el layout (que los pide a
 * Mercado Pago en el servidor) y las tarjetas y la ficha los leen de acá, sin
 * que cada página tenga que pasarlos.
 */
const InstallmentsContext = createContext<InstallmentPlan[]>([]);

export function InstallmentsProvider({ plans, children }: { plans: InstallmentPlan[]; children: ReactNode }) {
  return <InstallmentsContext.Provider value={plans}>{children}</InstallmentsContext.Provider>;
}

export function useInstallmentPlans(): InstallmentPlan[] {
  return useContext(InstallmentsContext);
}

/** "6 cuotas sin interés de $X" para una tarjeta. Nada si no hay cuotas sin interés. */
export function InstallmentsLine({ price, className }: { price: number; className?: string }) {
  const best = bestInterestFree(price, useInstallmentPlans());
  if (!best) return null;
  return (
    <p className={className ?? "text-[12px] font-semibold text-emerald-700"}>
      {best.installments} cuotas sin interés de {money(best.amount)}
    </p>
  );
}

/**
 * Cuotas en la ficha: la mejor opción sin interés arriba y la tabla completa
 * con precio final, CFT y TEA, que es lo que hay que informar al publicitar
 * cuotas. Sin planes de Mercado Pago no se dibuja.
 */
export function InstallmentsDetail({ price }: { price: number }) {
  const options = installmentOptions(price, useInstallmentPlans());
  if (!options.length) return null;

  const free = options.filter((option) => option.interestFree);
  const best = free.length ? free[free.length - 1] : null;
  const longest = options[options.length - 1];

  return (
    <details className="group rounded-xl border border-ink-100 px-3.5 py-2.5 text-[13px]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 leading-snug">
        <span className="text-ink-500">
          {best ? (
            <b className="text-emerald-700">
              {best.installments} cuotas sin interés de {money(best.amount)}
            </b>
          ) : (
            <b className="text-ink-900">
              Hasta {longest.installments} cuotas de {money(longest.amount)}
            </b>
          )}{" "}
          con tarjeta de crédito
          {!best && longest.cft ? <span className="font-bold text-ink-900"> · CFT {longest.cft}</span> : null}
        </span>
        <span className="shrink-0 text-xs font-bold text-brand-700 group-open:hidden">Ver cuotas</span>
        <span className="hidden shrink-0 text-xs font-bold text-brand-700 group-open:inline">Ocultar</span>
      </summary>
      <table className="mt-2.5 w-full text-left text-[12.5px] tabular-nums">
        <thead className="text-ink-400">
          <tr>
            <th className="py-1 pr-2 font-semibold">Cuotas</th>
            <th className="py-1 pr-2 font-semibold">Valor</th>
            <th className="py-1 pr-2 font-semibold">Total</th>
            <th className="py-1 pr-2 font-semibold">CFT</th>
            <th className="py-1 font-semibold">TEA</th>
          </tr>
        </thead>
        <tbody className="text-ink-700">
          {options.map((option) => (
            <tr key={option.installments} className="border-t border-ink-100">
              <td className="py-1 pr-2 font-semibold">{option.installments}</td>
              <td className={`py-1 pr-2 ${option.interestFree ? "font-bold text-emerald-700" : ""}`}>{money(option.amount)}</td>
              <td className="py-1 pr-2">{money(option.total)}</td>
              <td className="py-1 pr-2 font-bold text-ink-900">{option.cft ?? "—"}</td>
              <td className="py-1">{option.tea ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11.5px] leading-snug text-ink-400">
        En verde, sin interés. Planes de Mercado Pago con Visa. Algunos bancos pueden ofrecer otras cuotas al pagar.
      </p>
    </details>
  );
}
