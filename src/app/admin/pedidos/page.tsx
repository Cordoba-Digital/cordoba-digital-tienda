import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminOrderSearch } from "@/components/admin-order-search";
import { AdminOrdersWipeButton } from "@/components/admin-orders-wipe-button";
import { Pill } from "@/components/ui";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyAdminSessionValue } from "@/lib/admin-session";
import { ACTIONABLE_STATUSES, whatsappHref } from "@/lib/admin-order-helpers";
import { ACTIONABLE_FILTER, listAdminOrders } from "@/lib/admin-orders";
import { formatAgo, formatDateTime, money } from "@/lib/format";
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

function withParams(base: Record<string, string>, overrides: Record<string, string | null>): string {
  const params = new URLSearchParams(base);
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null || value === "") params.delete(key);
    else params.set(key, value);
  }
  const query = params.toString();
  return query ? `/admin/pedidos?${query}` : "/admin/pedidos";
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const jar = await cookies();
  if (!(await verifyAdminSessionValue(jar.get(ADMIN_COOKIE)?.value))) {
    redirect("/admin/login?next=/admin/pedidos");
  }

  const sp = await searchParams;
  const first = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));
  const q = first(sp.q).trim();
  const status = first(sp.status).trim();
  const page = Math.max(1, Number(first(sp.page)) || 1);

  await expireStalePendingOrders();
  const { orders, total, pages, stats } = await listAdminOrders({ q, status, page, perPage: 20 });
  const base = { ...(q ? { q } : {}), ...(status ? { status } : {}) };
  const allCount = Object.values(stats).reduce((sum, n) => sum + n, 0);
  const actionable = ACTIONABLE_STATUSES.reduce((sum, id) => sum + (stats[id] ?? 0), 0);
  const tabs = [
    { id: "", label: "Todos", count: allCount },
    { id: ACTIONABLE_FILTER, label: "Para atender", count: actionable },
    ...ADMIN_ORDER_STATUSES.map((s) => ({ id: s.id as string, label: s.label, count: stats[s.id] ?? 0 })),
  ];
  const from = total === 0 ? 0 : (page - 1) * 20 + 1;
  const to = Math.min(total, page * 20);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-700">Admin · Pedidos</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-ink-900 sm:text-3xl">Pedidos</h1>
          <p className="mt-1 text-sm text-ink-500">
            {allCount === 0
              ? "Todavía no entró ningún pedido."
              : actionable > 0
                ? `${actionable} ${actionable === 1 ? "pedido espera" : "pedidos esperan"} que hagas algo: cobrar, preparar o despachar.`
                : "Todo al día: no hay pedidos esperando."}
          </p>
        </div>
        {allCount > 0 ? <AdminOrdersWipeButton /> : null}
      </div>

      {/* En el celular las pestañas se deslizan de costado sin barra a la vista; en la compu bajan de renglón. */}
      <nav aria-label="Filtrar por estado" className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 lg:overflow-visible">
        <ul className="flex min-w-max gap-1.5 border-b border-ink-100 pb-px lg:min-w-0 lg:flex-wrap">
          {tabs.map((t) => {
            const active = status === t.id;
            return (
              <li key={t.id || "todos"}>
                <Link
                  href={withParams(base, { status: t.id || null, page: null })}
                  aria-current={active ? "page" : undefined}
                  className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors duration-150 ${active ? "border-ink-900 text-ink-900" : "border-transparent text-ink-500 hover:text-ink-900"}`}
                >
                  {t.label}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${t.id === ACTIONABLE_FILTER && t.count > 0 ? "bg-brand-700 text-white" : active ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-600"}`}
                  >
                    {t.count}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex flex-wrap items-center gap-2">
        <AdminOrderSearch key={q} initial={q} status={status} />
        {q || status ? (
          <Link href="/admin/pedidos" className="rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-bold text-ink-600 hover:border-ink-400">
            Limpiar filtros
          </Link>
        ) : null}
      </div>

      {orders.length === 0 ? (
        <div className="admin-card px-6 py-12 text-center">
          {allCount === 0 ? (
            <>
              <p className="text-base font-bold text-ink-900">Todavía no hay pedidos</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">
                Cuando alguien compre en la tienda, el pedido aparece acá y el número de la barra lateral te avisa cuántos esperan.
              </p>
            </>
          ) : (
            <>
              <p className="text-base font-bold text-ink-900">No hay pedidos con este filtro</p>
              <p className="mt-1 text-sm text-ink-500">
                {q ? <>Nada coincide con “{q}”. </> : null}
                <Link href="/admin/pedidos" className="font-semibold text-brand-700 hover:underline">Ver todos los pedidos</Link>
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="admin-table overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-4 py-3">Pedido</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Productos</th>
                  <th className="px-4 py-3">Pago / Entrega</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="w-12 px-2 py-3"><span className="sr-only">WhatsApp</span></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const wa = whatsappHref(o.phone, `Hola ${o.customerName.split(" ")[0]}! Te escribimos de Córdoba Digital por tu pedido ${o.code}.`);
                  return (
                    <tr key={o.id} className="relative border-b border-ink-50 last:border-0 hover:bg-ink-50/60">
                      <td className="whitespace-nowrap px-4 py-3 align-top">
                        <Link
                          href={`/admin/pedidos/${o.code}`}
                          className="font-bold text-brand-700 after:absolute after:inset-0 after:content-[''] hover:underline"
                        >
                          {o.code}
                        </Link>
                        <p className="whitespace-nowrap text-xs text-ink-500" title={formatDateTime(o.createdAt)}>{formatAgo(o.createdAt)}</p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="font-semibold text-ink-900">{o.customerName}</p>
                        <p className="text-xs text-ink-500">{o.email}</p>
                      </td>
                      <td className="max-w-[200px] px-4 py-3 align-top">
                        <p className="truncate text-ink-800" title={o.firstItem}>{o.firstItem || "—"}</p>
                        <p className="text-xs text-ink-500">
                          {o.itemsCount} {o.itemsCount === 1 ? "unidad" : "unidades"}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-top">
                        <p className="text-xs font-semibold text-ink-800">{o.paymentLabel || o.paymentMethod}</p>
                        <p className="text-xs text-ink-500">{o.deliveryLabel || o.deliveryMethod}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right align-top font-bold text-ink-900">{money(o.total)}</td>
                      <td className="px-4 py-3 align-top">
                        <Pill solid tone={statusTone(o.status)} className="whitespace-nowrap">{statusLabel(o.status)}</Pill>
                      </td>
                      <td className="px-2 py-3 text-right align-top">
                        {wa ? (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Escribirle a ${o.customerName} por WhatsApp`}
                            aria-label={`Escribirle a ${o.customerName} por WhatsApp`}
                            className="relative z-10 inline-grid h-8 w-8 place-items-center rounded-lg border border-ink-200 bg-surface text-ink-600 hover:border-emerald-500 hover:text-emerald-700"
                          >
                            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4" aria-hidden>
                              <path d="M4.2 15.8 5 12.9A6.5 6.5 0 1 1 7.4 15.2l-3.2.6Z" strokeLinejoin="round" />
                            </svg>
                          </a>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {total > 0 ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-ink-500">
            {pages > 1 ? `Mostrando ${from}–${to} de ${total}` : `${total} ${total === 1 ? "pedido" : "pedidos"}`}
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={withParams({ ...base, page: String(page - 1) }, {})}
                className="rounded-lg border border-ink-200 px-4 py-2 text-xs font-bold text-ink-700"
              >
                ← Anterior
              </Link>
            ) : null}
            {page < pages ? (
              <Link
                href={withParams({ ...base, page: String(page + 1) }, {})}
                className="rounded-lg border border-ink-200 px-4 py-2 text-xs font-bold text-ink-700"
              >
                Siguiente →
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
