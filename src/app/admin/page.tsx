import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";

import { AdminMonthlyChart } from "@/components/admin-monthly-chart";
import { AdminTickMeter } from "@/components/admin-tick-meter";
import { Pill } from "@/components/ui";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyAdminSessionValue } from "@/lib/admin-session";
import { getAdminStats, RANGE_OPTIONS, type RangeDays } from "@/lib/admin-stats";
import { money } from "@/lib/format";
import { expireStalePendingOrders } from "@/lib/order-status";
import { statusLabel } from "@/lib/pricing";

export const dynamic = "force-dynamic";

function statusTone(status: string): "amber" | "brand" | "success" | "neutral" {
  switch (status) {
    case "pendiente_pago":
      return "amber";
    case "pago_confirmado":
    case "preparando":
      return "brand";
    case "enviado":
    case "entregado":
      return "success";
    default:
      return "neutral";
  }
}

const card = "admin-panel-card";
const cardTitle = "text-[15px] font-semibold text-ink-900";
const link = "rounded-full px-3 py-1 text-xs font-semibold text-ink-600 shadow-[0_0_0_1px_oklch(0_0_0/0.08)] transition-[background-color] duration-150 hover:bg-ink-50";

const COLORS = { cobrar: "#eb6834", curso: "#e0457b", entregado: "#2fa36b" };

/** Variación contra el período anterior del mismo largo. Sin base, no se muestra. */
function Delta({ now, before }: { now: number; before: number }) {
  if (before <= 0) return <span className="text-[11px] text-ink-400">sin período anterior</span>;
  const pct = Math.round(((now - before) / before) * 1000) / 10;
  const up = pct >= 0;
  return (
    <span className={`text-[11px] font-semibold tabular-nums ${up ? "text-emerald-700" : "text-red-600"}`}>
      {up ? "▲" : "▼"} {Math.abs(pct).toLocaleString("es-AR")}%
    </span>
  );
}

function StatusCard({ href, label, value, total, color, note }: { href: string; label: string; value: number; total: number; color: string; note?: string }) {
  return (
    <Link href={href} className={`${card} block p-5 transition-[box-shadow] duration-150 hover:shadow-[0_0_0_1px_oklch(0_0_0/0.1),0_2px_6px_oklch(0_0_0/0.06)]`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[15px] text-ink-700">{label}</p>
        {note ? <span className="text-xs font-semibold tabular-nums text-ink-500">{note}</span> : null}
      </div>
      <p className="mt-2 text-3xl font-medium tabular-nums tracking-tight text-ink-900">{value.toLocaleString("es-AR")}</p>
      <div className="mt-3 flex items-baseline justify-between text-xs text-ink-400">
        <span>de {total.toLocaleString("es-AR")} pedidos</span>
        <span className="tabular-nums">
          {value}/{total}
        </span>
      </div>
      <div className="mt-2">
        <AdminTickMeter value={value} total={total} color={color} />
      </div>
    </Link>
  );
}

function Metric({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-ink-500">{label}</p>
      <p className="mt-1 text-xl font-medium tabular-nums tracking-tight text-ink-900">{value}</p>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function Thumb({ src }: { src: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" referrerPolicy="no-referrer" className="h-10 w-10 shrink-0 rounded-full bg-white object-contain p-1 outline outline-1 -outline-offset-1 outline-black/10" />
  ) : (
    <span className="h-10 w-10 shrink-0 rounded-full bg-ink-50" />
  );
}

/** Barra horizontal de progreso (lista de más vendidos y stock). */
function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(4, Math.min(100, (value / max) * 100)) : 0;
  return (
    <span className="block h-2.5 w-full overflow-hidden rounded-full bg-ink-50">
      <span className="block h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
    </span>
  );
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Cordoba", day: "numeric", month: "short" });
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminDashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const jar = await cookies();
  if (!(await verifyAdminSessionValue(jar.get(ADMIN_COOKIE)?.value))) {
    redirect("/admin/login?next=/admin");
  }
  const sp = await searchParams;
  const raw = Number(Array.isArray(sp.rango) ? sp.rango[0] : sp.rango);
  const range: RangeDays = (RANGE_OPTIONS as readonly number[]).includes(raw) ? (raw as RangeDays) : 30;

  // Vence los pedidos sin pago antes de contar, por si el cron diario no corrió.
  await expireStalePendingOrders();
  const s = await getAdminStats(range);

  const enCurso = (s.byStatus.pago_confirmado ?? 0) + (s.byStatus.preparando ?? 0) + (s.byStatus.enviado ?? 0);
  const porCobrar = s.byStatus.pendiente_pago ?? 0;
  const entregados = s.byStatus.entregado ?? 0;
  const activos = porCobrar + enCurso + entregados;
  const topUnits = Math.max(0, ...s.topProducts.map((p) => p.units));
  const maxSeg = Math.max(s.segments.newCustomers, s.segments.returningCustomers, 1);

  return (
    <div className="space-y-4">
      <div className="admin-enter flex flex-wrap items-end justify-between gap-3" style={{ "--i": 0 } as CSSProperties}>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">Panel</h1>
          <p className="mt-1 text-sm text-ink-500">
            Hoy llevás <span className="font-semibold tabular-nums text-ink-900">{money(s.todayRevenue)}</span> en ventas pagadas.
          </p>
        </div>
        <nav aria-label="Período" className="flex rounded-full bg-surface p-1 shadow-[0_0_0_1px_oklch(0_0_0/0.06)]">
          {RANGE_OPTIONS.map((r) => (
            <Link
              key={r}
              href={r === 30 ? "/admin" : `/admin?rango=${r}`}
              aria-current={r === range ? "page" : undefined}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-[background-color,color] duration-150 ${r === range ? "bg-ink-900 text-white" : "text-ink-600 hover:text-ink-900"}`}
            >
              {r} días
            </Link>
          ))}
        </nav>
      </div>

      <div className="admin-enter grid gap-4 md:grid-cols-3" style={{ "--i": 1 } as CSSProperties}>
        <StatusCard href="/admin/pedidos?status=pendiente_pago" label="Por cobrar" value={porCobrar} total={activos} color={COLORS.cobrar} note={money(s.pendingRevenue)} />
        <StatusCard href="/admin/pedidos" label="En curso" value={enCurso} total={activos} color={COLORS.curso} note="pagados, sin entregar" />
        <StatusCard href="/admin/pedidos?status=entregado" label="Entregados" value={entregados} total={activos} color={COLORS.entregado} />
      </div>

      <div className="admin-enter grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_360px]" style={{ "--i": 2 } as CSSProperties}>
        <section className={`${card} p-5`}>
          <div className="mb-5">
            <h2 className={cardTitle}>Ventas por mes</h2>
            <p className="mt-0.5 text-xs text-ink-400">Pedidos con pago acreditado, últimos 12 meses</p>
          </div>
          <AdminMonthlyChart data={s.monthly} />
        </section>

        <section className={`${card} p-5`}>
          <h2 className={cardTitle}>Resumen</h2>
          <p className="mt-0.5 text-xs text-ink-400">Últimos {range} días contra los {range} anteriores</p>
          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6">
            <Metric label="Ventas" value={money(s.current.revenue)}>
              <Delta now={s.current.revenue} before={s.previous.revenue} />
            </Metric>
            <Metric label="Pedidos pagados" value={s.current.orders.toLocaleString("es-AR")}>
              <Delta now={s.current.orders} before={s.previous.orders} />
            </Metric>
            <Metric label="Clientes" value={s.current.customers.toLocaleString("es-AR")}>
              <Delta now={s.current.customers} before={s.previous.customers} />
            </Metric>
            <Metric label="Ticket promedio" value={money(s.current.avgTicket)}>
              <Delta now={s.current.avgTicket} before={s.previous.avgTicket} />
            </Metric>
          </div>
          <div className="mt-6 border-t border-ink-100 pt-4">
            <p className="text-xs text-ink-500">Clientes del período</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {[
                { label: "Nuevos", n: s.segments.newCustomers, from: "#f59a6b", to: "#eb6834" },
                { label: "Recurrentes", n: s.segments.returningCustomers, from: "#6fd3a5", to: "#2fa36b" },
              ].map((seg) => (
                <div key={seg.label}>
                  <p className="flex items-baseline justify-between text-xs text-ink-500">
                    {seg.label} <span className="text-sm font-medium tabular-nums text-ink-900">{seg.n}</span>
                  </p>
                  <div className="mt-2 flex h-16 items-end">
                    <span
                      className="w-full rounded-lg"
                      style={{ height: `${Math.max(6, (seg.n / maxSeg) * 100)}%`, background: `linear-gradient(180deg, ${seg.to} 0%, ${seg.from}26 100%)` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="admin-enter grid gap-4 lg:grid-cols-2" style={{ "--i": 3 } as CSSProperties}>
        <section className={`${card} p-5`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className={cardTitle}>Más vendidos</h2>
            <span className="text-xs text-ink-400">últimos {range} días</span>
          </div>
          {s.topProducts.length === 0 ? (
            <p className="text-sm text-ink-500">Todavía no hay ventas pagadas en el período.</p>
          ) : (
            <ul className="space-y-3.5">
              {s.topProducts.map((p) => (
                <li key={p.slug}>
                  <Link href={`/admin/productos/${encodeURIComponent(p.slug)}`} className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,9rem)] items-center gap-3">
                    <Thumb src={p.image} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-ink-900">{p.name}</span>
                      <span className="block text-xs tabular-nums text-ink-400">{money(p.revenue)}</span>
                    </span>
                    <span>
                      <Bar value={p.units} max={topUnits} color={COLORS.cobrar} />
                      <span className="mt-1 flex justify-between text-[11px] text-ink-400">
                        vendidos <span className="tabular-nums text-ink-600">{p.units}</span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={`${card} p-5`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className={cardTitle}>Stock</h2>
            <Link href="/admin/productos?stock=sin" className={link}>
              {s.outOfStockCount.toLocaleString("es-AR")} sin stock
            </Link>
          </div>
          {s.stockAlerts.length === 0 ? (
            <p className="text-sm text-ink-500">Ningún producto con stock bajo (2 a 5 unidades).</p>
          ) : (
            <ul className="space-y-3.5">
              {s.stockAlerts.map((p) => (
                <li key={p.slug}>
                  <Link href={`/admin/productos/${encodeURIComponent(p.slug)}`} className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,9rem)] items-center gap-3">
                    <Thumb src={p.image} />
                    <span className="truncate text-sm text-ink-900">{p.name}</span>
                    <span>
                      <Bar value={p.stock} max={5} color={p.stock <= 2 ? "#dc2626" : "#d97706"} />
                      <span className="mt-1 flex justify-between text-[11px] text-ink-400">
                        quedan <span className="tabular-nums text-ink-600">{p.stock}/5</span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className={`${card} admin-enter overflow-hidden`} style={{ "--i": 4 } as CSSProperties}>
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className={cardTitle}>Últimos pedidos</h2>
          <Link href="/admin/pedidos" className={link}>
            Ver todos
          </Link>
        </div>
        {s.recentOrders.length === 0 ? (
          <p className="px-5 py-5 text-sm text-ink-500">Sin pedidos todavía.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="mt-3 w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-y border-ink-100 text-[11px] uppercase tracking-wide text-ink-400">
                  <th className="px-5 py-2 font-medium">Pedido</th>
                  <th className="px-3 py-2 font-medium">Cliente</th>
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                  <th className="px-5 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {s.recentOrders.map((o) => (
                  <tr key={o.code} className="border-b border-ink-50 last:border-0">
                    <td className="px-5 py-3">
                      <Link href={`/admin/pedidos/${o.code}`} className="font-semibold text-ink-900 hover:text-brand-700">
                        {o.code}
                      </Link>
                    </td>
                    <td className="max-w-[180px] truncate px-3 py-3 text-ink-700">{o.customerName}</td>
                    <td className="px-3 py-3 text-ink-500">{formatDate(o.createdAt)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-ink-900">{money(o.total)}</td>
                    <td className="px-5 py-3">
                      <Pill solid tone={statusTone(o.status)}>{statusLabel(o.status)}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
