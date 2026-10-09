import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AdminSalesChart } from "@/components/admin-sales-chart";
import { Pill } from "@/components/ui";
import { ADMIN_COOKIE, verifyAdminSessionValue } from "@/lib/admin-auth";
import { getAdminStats, RANGE_OPTIONS, type RangeDays } from "@/lib/admin-stats";
import { money } from "@/lib/format";
import { expireStalePendingOrders } from "@/lib/order-status";
import { ADMIN_ORDER_STATUSES, statusLabel } from "@/lib/pricing";

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

const card = "rounded-lg border border-ink-100 bg-surface";

/** Variación contra el período anterior del mismo largo. Sin base, no se muestra. */
function Delta({ now, before }: { now: number; before: number }) {
  if (before <= 0) return <span className="text-xs text-ink-500">sin datos del período anterior</span>;
  const pct = Math.round(((now - before) / before) * 1000) / 10;
  const up = pct >= 0;
  return (
    <span className={`text-xs font-semibold ${up ? "text-emerald-700" : "text-rose-700"}`}>
      {up ? "▲" : "▼"} {Math.abs(pct).toLocaleString("es-AR")}% <span className="hidden font-normal text-ink-500 sm:inline">vs. período anterior</span>
    </span>
  );
}

function Kpi({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  return (
    <div className={`${card} p-4`}>
      <p className="text-xs font-semibold text-ink-500">{label}</p>
      <p className="mt-1 text-xl font-black tracking-tight text-ink-900 sm:text-2xl">{value}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Thumb({ src }: { src: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" referrerPolicy="no-referrer" className="h-11 w-11 shrink-0 rounded-lg border border-ink-100 bg-white object-contain p-0.5" />
  ) : (
    <span className="h-11 w-11 shrink-0 rounded-lg bg-ink-50" />
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
  const totalCustomers = s.segments.newCustomers + s.segments.returningCustomers;
  const newPct = totalCustomers ? Math.round((s.segments.newCustomers / totalCustomers) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-ink-900 sm:text-3xl">Panel</h1>
          <p className="mt-1 text-sm text-ink-500">Ventas pagadas de los últimos {range} días. Hoy: {money(s.todayRevenue)}.</p>
        </div>
        <nav aria-label="Período" className="flex rounded-lg border border-ink-200 bg-surface p-0.5">
          {RANGE_OPTIONS.map((r) => (
            <Link
              key={r}
              href={r === 30 ? "/admin" : `/admin?rango=${r}`}
              aria-current={r === range ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${r === range ? "bg-ink-900 text-white" : "text-ink-600 hover:text-ink-900"}`}
            >
              {r} días
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi label="Ventas" value={money(s.current.revenue)}>
          <Delta now={s.current.revenue} before={s.previous.revenue} />
        </Kpi>
        <Kpi label="Pedidos pagados" value={s.current.orders.toLocaleString("es-AR")}>
          <Delta now={s.current.orders} before={s.previous.orders} />
        </Kpi>
        <Kpi label="Clientes" value={s.current.customers.toLocaleString("es-AR")}>
          <Delta now={s.current.customers} before={s.previous.customers} />
        </Kpi>
        <Kpi label="Ticket promedio" value={money(s.current.avgTicket)}>
          <Delta now={s.current.avgTicket} before={s.previous.avgTicket} />
        </Kpi>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className={`${card} p-5`}>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-bold text-ink-900">Ventas por día</h2>
            <p className="text-xs text-ink-500">Solo pedidos con pago acreditado</p>
          </div>
          <AdminSalesChart data={s.daily} />
        </section>

        <section className={`${card} p-5`}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-ink-900">Alertas de stock</h2>
            <Link href="/admin/productos?stock=sin" className="text-xs font-bold text-brand-700 hover:underline">Ver →</Link>
          </div>
          <Link href="/admin/productos?stock=sin" className="mb-3 flex items-center justify-between rounded-lg bg-rose-50 px-3 py-2.5">
            <span className="text-sm font-semibold text-rose-800">⚠ Sin stock</span>
            <span className="text-sm font-black text-rose-800">{s.outOfStockCount.toLocaleString("es-AR")} productos</span>
          </Link>
          {s.stockAlerts.length === 0 ? (
            <p className="text-sm text-ink-500">Ningún producto con stock bajo (2 a 5 unidades).</p>
          ) : (
            <ul className="space-y-2.5">
              {s.stockAlerts.map((p) => (
                <li key={p.slug}>
                  <Link href={`/admin/productos/${encodeURIComponent(p.slug)}`} className="flex items-center gap-3">
                    <Thumb src={p.image} />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-800">{p.name}</span>
                    <span className="shrink-0 text-xs font-bold text-amber-700">quedan {p.stock}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className={`${card} overflow-hidden`}>
          <div className="flex items-center justify-between px-5 pt-5">
            <h2 className="text-base font-bold text-ink-900">Últimos pedidos</h2>
            <Link href="/admin/pedidos" className="text-xs font-bold text-brand-700 hover:underline">Ver todos →</Link>
          </div>
          {s.recentOrders.length === 0 ? (
            <p className="px-5 py-5 text-sm text-ink-500">Sin pedidos todavía.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="mt-3 w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-y border-ink-100 text-[11px] uppercase tracking-wide text-ink-500">
                    <th className="px-5 py-2 font-semibold">Pedido</th>
                    <th className="px-3 py-2 font-semibold">Cliente</th>
                    <th className="px-3 py-2 font-semibold">Fecha</th>
                    <th className="px-3 py-2 text-right font-semibold">Total</th>
                    <th className="px-5 py-2 font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {s.recentOrders.map((o) => (
                    <tr key={o.code} className="border-b border-ink-50 last:border-0">
                      <td className="px-5 py-2.5">
                        <Link href={`/admin/pedidos/${o.code}`} className="font-bold text-ink-900 hover:text-brand-700">{o.code}</Link>
                      </td>
                      <td className="max-w-[180px] truncate px-3 py-2.5 text-ink-700">{o.customerName}</td>
                      <td className="px-3 py-2.5 text-ink-500">{formatDate(o.createdAt)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-ink-900">{money(o.total)}</td>
                      <td className="px-5 py-2.5"><Pill tone={statusTone(o.status)}>{statusLabel(o.status)}</Pill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="space-y-4">
          <section className={`${card} p-5`}>
            <h2 className="mb-3 text-base font-bold text-ink-900">Clientes del período</h2>
            {totalCustomers === 0 ? (
              <p className="text-sm text-ink-500">Todavía no hay compras pagadas en el período.</p>
            ) : (
              <>
                <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`${s.segments.newCustomers} nuevos y ${s.segments.returningCustomers} recurrentes`}>
                  {s.segments.newCustomers ? <span className="h-full rounded-l-full bg-[#2a78d6]" style={{ width: `${newPct}%` }} /> : null}
                  {s.segments.returningCustomers ? <span className="h-full flex-1 rounded-r-full bg-[#eb6834]" /> : null}
                </div>
                <ul className="mt-3 space-y-1.5 text-sm">
                  <li className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-ink-600"><span className="h-2.5 w-2.5 rounded-sm bg-[#2a78d6]" />Nuevos (primera compra)</span>
                    <span className="font-bold text-ink-900">{s.segments.newCustomers} · {newPct}%</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-ink-600"><span className="h-2.5 w-2.5 rounded-sm bg-[#eb6834]" />Recurrentes</span>
                    <span className="font-bold text-ink-900">{s.segments.returningCustomers} · {100 - newPct}%</span>
                  </li>
                </ul>
              </>
            )}
          </section>

          <section className={`${card} p-5`}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-bold text-ink-900">Pedidos por estado</h2>
              <Link href="/admin/pedidos?status=pendiente_pago" className="text-xs font-bold text-brand-700 hover:underline">
                {money(s.pendingRevenue)} por cobrar
              </Link>
            </div>
            <ul>
              {ADMIN_ORDER_STATUSES.map((st) => (
                <li key={st.id}>
                  <Link href={`/admin/pedidos?status=${st.id}`} className="flex items-center justify-between rounded-lg px-1 py-1.5 hover:bg-ink-50">
                    <Pill tone={statusTone(st.id)}>{st.label}</Pill>
                    <span className="text-sm font-bold text-ink-900">{s.byStatus[st.id] ?? 0}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <section className={`${card} p-5`}>
        <h2 className="mb-4 text-base font-bold text-ink-900">Más vendidos del período</h2>
        {s.topProducts.length === 0 ? (
          <p className="text-sm text-ink-500">Todavía no hay ventas pagadas en el período.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {s.topProducts.map((p) => (
              <li key={p.slug} className="overflow-hidden rounded-lg border border-ink-100">
                <Link href={`/admin/productos/${encodeURIComponent(p.slug)}`} className="block">
                  <div className="aspect-square bg-white">
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image} alt="" referrerPolicy="no-referrer" className="h-full w-full object-contain p-3" />
                    ) : null}
                  </div>
                  <div className="border-t border-ink-100 p-3">
                    <p className="line-clamp-2 text-sm font-semibold text-ink-900">{p.name}</p>
                    <p className="mt-1 text-xs text-ink-500">{p.units} vendidos</p>
                    <p className="mt-0.5 text-sm font-bold text-ink-900">{money(p.revenue)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
