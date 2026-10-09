import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminLogoutButton } from "@/components/admin-logout-button";
import { Pill } from "@/components/ui";
import { ADMIN_COOKIE, verifyAdminSessionValue } from "@/lib/admin-auth";
import { getAdminStats } from "@/lib/admin-stats";
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

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export default async function AdminDashboardPage() {
  const jar = await cookies();
  if (!(await verifyAdminSessionValue(jar.get(ADMIN_COOKIE)?.value))) {
    redirect("/admin/login?next=/admin");
  }
  // Vence los pedidos sin pago antes de contar, por si el cron diario no corrió.
  await expireStalePendingOrders();
  const stats = await getAdminStats();

  const kpis = [
    { label: "Ventas de hoy", value: money(stats.todayRevenue), sub: plural(stats.todayCount, "pedido pagado", "pedidos pagados") },
    { label: "Ventas del mes", value: money(stats.monthRevenue), sub: plural(stats.monthCount, "pedido pagado", "pedidos pagados") },
    {
      label: "Por cobrar",
      value: money(stats.monthPendingRevenue),
      sub: `${plural(stats.monthPendingCount, "pedido", "pedidos")} sin pago este mes`,
      href: "/admin/pedidos?status=pendiente_pago",
    },
    { label: "Ticket promedio", value: money(stats.avgTicket), sub: "pagados este mes" },
    {
      label: "Sin stock",
      value: String(stats.outOfStockCount),
      sub: "productos para revisar",
      href: "/admin/productos?sinStock=1",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-700">Admin</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-ink-900 sm:text-3xl">Panel</h1>
          <p className="mt-1 text-sm text-ink-500">Resumen del negocio de un vistazo.</p>
        </div>
        <AdminLogoutButton />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((kpi) => {
          const card = (
            <div className="card-surface p-4">
              <p className="text-xs font-bold text-ink-500">{kpi.label}</p>
              <p className="mt-1 text-2xl font-black text-ink-900">{kpi.value}</p>
              <p className="text-xs text-ink-500">{kpi.sub}</p>
            </div>
          );
          return kpi.href ? (
            <Link key={kpi.label} href={kpi.href} className="transition hover:opacity-90">
              {card}
            </Link>
          ) : (
            <div key={kpi.label}>{card}</div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card-surface p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-ink-900">Pedidos por estado</h2>
            <Link href="/admin/pedidos" className="text-xs font-bold text-brand-700 hover:underline">
              Ver pedidos →
            </Link>
          </div>
          <ul className="space-y-2">
            {ADMIN_ORDER_STATUSES.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/admin/pedidos?status=${s.id}`}
                  className="flex items-center justify-between rounded-xl px-3 py-2 transition hover:bg-ink-50"
                >
                  <Pill tone={statusTone(s.id)}>{s.label}</Pill>
                  <span className="text-lg font-black text-ink-900">{stats.byStatus[s.id] ?? 0}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="card-surface p-5">
          <h2 className="mb-3 text-lg font-extrabold text-ink-900">Más vendidos del mes <span className="text-xs font-semibold text-ink-400">(pagados)</span></h2>
          {stats.topProducts.length === 0 ? (
            <p className="text-sm text-ink-500">Todavía no hay ventas este mes.</p>
          ) : (
            <ul className="space-y-2">
              {stats.topProducts.map((p) => (
                <li key={p.slug} className="flex items-center justify-between gap-2 text-sm">
                  <Link href={`/producto/${p.slug}`} className="min-w-0 flex-1 truncate font-semibold text-ink-800 hover:text-brand-700">
                    {p.name}
                  </Link>
                  <span className="shrink-0 text-xs text-ink-500">{p.units} u.</span>
                  <span className="shrink-0 font-bold text-ink-900">{money(p.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card-surface p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-ink-900">Últimos pedidos</h2>
            <Link href="/admin/pedidos" className="text-xs font-bold text-brand-700 hover:underline">
              Ver todos →
            </Link>
          </div>
          {stats.recentOrders.length === 0 ? (
            <p className="text-sm text-ink-500">Sin pedidos todavía.</p>
          ) : (
            <ul className="space-y-2">
              {stats.recentOrders.map((o) => (
                <li key={o.code} className="flex items-center justify-between gap-2 text-sm">
                  <Link href={`/admin/pedidos/${o.code}`} className="font-bold text-brand-700 hover:underline">
                    {o.code}
                  </Link>
                  <span className="min-w-0 flex-1 truncate text-xs text-ink-500">{o.customerName}</span>
                  <span className="shrink-0 font-bold text-ink-900">{money(o.total)}</span>
                  <Pill tone={statusTone(o.status)}>{statusLabel(o.status)}</Pill>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card-surface p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-ink-900">Sin stock ({stats.outOfStockCount})</h2>
            <Link href="/admin/productos?sinStock=1" className="text-xs font-bold text-brand-700 hover:underline">
              Gestionar →
            </Link>
          </div>
          {stats.outOfStockSample.length === 0 ? (
            <p className="text-sm text-ink-500">Todo el catálogo tiene stock. 🎉</p>
          ) : (
            <ul className="space-y-2">
              {stats.outOfStockSample.map((p) => (
                <li key={p.slug} className="flex items-center justify-between gap-2 text-sm">
                  <Link
                    href={`/admin/productos?q=${encodeURIComponent(p.slug)}`}
                    className="min-w-0 flex-1 truncate font-semibold text-ink-800 hover:text-brand-700"
                  >
                    {p.name}
                  </Link>
                  <span className="shrink-0 font-bold text-ink-900">{money(p.price)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
