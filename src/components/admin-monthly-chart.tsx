"use client";

import { useState } from "react";

import { money } from "@/lib/format";

type Month = { month: string; revenue: number; orders: number };

const ACCENT = "#e0457b";

function niceMax(value: number): number {
  if (value <= 0) return 1000;
  const pow = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= value) ?? 10;
  return step * pow;
}

function shortMoney(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000).toLocaleString("es-AR")} k`;
  return `$${value}`;
}

function monthLabel(month: string, long = false): string {
  const [y, m] = month.split("-").map(Number);
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("es-AR", { timeZone: "UTC", month: long ? "long" : "short" });
  return (long ? `${label} ${y}` : label).replace(".", "");
}

/**
 * Ventas pagadas por mes, últimos 12. El mes actual va resaltado; pasando el
 * mouse (o tocando) por otro mes se ve su detalle.
 */
export function AdminMonthlyChart({ data }: { data: Month[] }) {
  const current = data.length - 1;
  const [active, setActive] = useState(current);
  const max = niceMax(Math.max(0, ...data.map((m) => m.revenue)));
  const ticks = [max, (max * 3) / 4, max / 2, max / 4];
  const point = data[active];

  return (
    <div>
      <div className="flex gap-3">
        <div className="relative h-56 w-12 shrink-0 text-right text-[11px] text-ink-400" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${(1 - t / max) * 100}%` }}>
              {shortMoney(t)}
            </span>
          ))}
        </div>
        <div className="flex h-56 flex-1 items-end gap-1.5 sm:gap-2.5" role="img" aria-label="Ventas pagadas por mes, últimos 12 meses" onPointerLeave={() => setActive(current)}>
          {data.map((m, i) => {
            const h = Math.max(2, (m.revenue / max) * 100);
            const on = i === active;
            return (
              <div key={m.month} className="relative flex h-full flex-1 items-end" onPointerEnter={() => setActive(i)} onPointerDown={() => setActive(i)}>
                {on ? (
                  <span
                    className={`pointer-events-none absolute z-10 -translate-y-full ${i === data.length - 1 ? "right-0" : i === 0 ? "left-0" : "left-1/2 -translate-x-1/2"} whitespace-nowrap rounded-full bg-ink-900 px-2 py-0.5 text-[10px] font-semibold text-white`}
                    style={{ bottom: `calc(${h}% + 6px)` }}
                  >
                    {shortMoney(m.revenue)}
                  </span>
                ) : null}
                <span
                  className="w-full rounded-t-md transition-[background] duration-150"
                  style={{
                    height: `${h}%`,
                    background: on
                      ? `linear-gradient(180deg, ${ACCENT} 0%, ${ACCENT}33 100%)`
                      : `repeating-linear-gradient(135deg, ${ACCENT}14 0 4px, ${ACCENT}08 4px 8px)`,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div className="ml-[3.75rem] mt-2 flex gap-1.5 sm:gap-2.5" aria-hidden="true">
        {data.map((m, i) => (
          <span
            key={m.month}
            className={`flex-1 truncate rounded-full py-0.5 text-center text-[10px] capitalize ${i === active ? "bg-ink-900 text-white" : "bg-ink-50 text-ink-500"}`}
          >
            <span className="sm:hidden">{monthLabel(m.month).slice(0, 1)}</span>
            <span className="hidden sm:inline">{monthLabel(m.month)}</span>
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-500" aria-live="polite">
        <span className="capitalize">{monthLabel(point.month, true)}</span>: <span className="font-semibold text-ink-900">{money(point.revenue)}</span> en{" "}
        {point.orders} {point.orders === 1 ? "pedido pagado" : "pedidos pagados"}
      </p>
      <table className="sr-only">
        <caption>Ventas pagadas por mes</caption>
        <thead>
          <tr>
            <th>Mes</th>
            <th>Ventas</th>
            <th>Pedidos</th>
          </tr>
        </thead>
        <tbody>
          {data.map((m) => (
            <tr key={m.month}>
              <td>{monthLabel(m.month, true)}</td>
              <td>{money(m.revenue)}</td>
              <td>{m.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
