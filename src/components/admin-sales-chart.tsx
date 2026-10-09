"use client";

import { useState } from "react";

import { money } from "@/lib/format";

type Point = { day: string; revenue: number; orders: number };

const W = 720;
const H = 200;

function niceMax(value: number): number {
  if (value <= 0) return 1000;
  const pow = 10 ** Math.floor(Math.log10(value));
  const steps = [1, 2, 2.5, 5, 10];
  const step = steps.find((s) => s * pow >= value) ?? 10;
  return step * pow;
}

function shortMoney(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 2 })} M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000).toLocaleString("es-AR")} k`;
  return `$${value}`;
}

function dayLabel(day: string, long = false): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString("es-AR", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    ...(long ? { weekday: "short" } : {}),
  });
}

/**
 * Ventas pagadas por día: una sola serie (área), sin leyenda. El cursor marca
 * el día más cercano y muestra monto y pedidos; la tabla de abajo (oculta a la
 * vista, visible para lectores de pantalla) tiene los mismos datos.
 */
export function AdminSalesChart({ data }: { data: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...data.map((p) => p.revenue)));
  const n = data.length;
  const x = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => H - (v / max) * H;
  const line = data.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.revenue).toFixed(1)}`).join(" ");
  const area = n ? `${line} L${x(n - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z` : "";
  const ticks = [max, max / 2, 0];
  const labelEvery = Math.max(1, Math.ceil(n / 6));
  const point = hover !== null ? data[hover] : null;

  function onMove(event: React.PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    setHover(Math.round(ratio * (n - 1)));
  }

  return (
    <div>
      <div className="flex gap-3">
        <div className="flex h-[240px] flex-col justify-between py-0 text-right text-[11px] text-ink-500" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">{shortMoney(t)}</span>
          ))}
        </div>
        <div
          className="relative h-[240px] flex-1 touch-none"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={`Ventas por día de los últimos ${n} días`}
        >
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
            {ticks.map((t) => (
              <line key={t} x1={0} x2={W} y1={y(t)} y2={y(t)} stroke="var(--color-ink-100)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
            <defs>
              <linearGradient id="ventas-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#eb6834" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#eb6834" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#ventas-fill)" />
            <path d={line} fill="none" stroke="#eb6834" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {hover !== null ? (
              <line x1={x(hover)} x2={x(hover)} y1={0} y2={H} stroke="var(--color-ink-400)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ) : null}
          </svg>
          {point && hover !== null ? (
            <>
              <span
                className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-[#eb6834]"
                style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(point.revenue) / H) * 100}%` }}
              />
              <div
                className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-ink-100 bg-surface px-3 py-2 shadow-lg"
                style={{ left: `${Math.min(88, Math.max(12, (x(hover) / W) * 100))}%` }}
              >
                <p className="text-sm font-bold text-ink-900">{money(point.revenue)}</p>
                <p className="text-[11px] text-ink-500">
                  {dayLabel(point.day, true)} · {point.orders} {point.orders === 1 ? "pedido" : "pedidos"}
                </p>
              </div>
            </>
          ) : null}
        </div>
      </div>
      <div className="relative ml-12 mt-2 h-4 text-[11px] text-ink-500" aria-hidden="true">
        {data.map((p, i) =>
          i % labelEvery === 0 || i === n - 1 ? (
            <span key={p.day} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${(x(i) / W) * 100}%` }}>
              {dayLabel(p.day)}
            </span>
          ) : null,
        )}
      </div>
      <table className="sr-only">
        <caption>Ventas pagadas por día</caption>
        <thead>
          <tr>
            <th>Día</th>
            <th>Ventas</th>
            <th>Pedidos</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.day}>
              <td>{p.day}</td>
              <td>{money(p.revenue)}</td>
              <td>{p.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
