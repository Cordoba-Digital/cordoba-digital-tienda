import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminLogoutButton } from "@/components/admin-logout-button";
import { Pill } from "@/components/ui";
import { ADMIN_COOKIE, verifyAdminSessionValue } from "@/lib/admin-auth";
import { listAdminOrders } from "@/lib/admin-orders";
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-700">Admin · Pedidos</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-ink-900 sm:text-3xl">Pedidos</h1>
          <p className="mt-1 text-sm text-ink-500">{total} pedidos en total. Buscá por código, cliente o email.</p>
        </div>
        <AdminLogoutButton />
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {ADMIN_ORDER_STATUSES.map((s) => (
          <Link
            key={s.id}
            href={withParams(base, { status: status === s.id ? null : s.id, page: null })}
            className={`card-surface p-4 transition ${status === s.id ? "ring-2 ring-brand-500" : ""}`}
          >
            <p className="text-xs font-bold text-ink-500">{s.label}</p>
            <p className="mt-1 text-2xl font-black text-ink-900">{stats[s.id] ?? 0}</p>
          </Link>
        ))}
      </div>

      <form action="/admin/pedidos" method="get" className="flex flex-wrap gap-2">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por código, nombre o email…"
          className="min-w-0 flex-1 rounded-xl border border-ink-200 bg-surface px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-400"
        />
        <button type="submit" className="rounded-xl bg-ink-900 px-4 py-2.5 text-sm font-bold text-white">
          Buscar
        </button>
        {q || status ? (
          <Link href="/admin/pedidos" className="rounded-xl border border-ink-200 px-4 py-2.5 text-sm font-bold text-ink-600">
            Limpiar
          </Link>
        ) : null}
      </form>

      <div className="card-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
                <th className="px-4 py-3">Pedido</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Pago / Envío</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-500">Sin pedidos para este filtro.</td></tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/pedidos/${o.code}`} className="font-bold text-brand-700 hover:underline">
                        {o.code}
                      </Link>
                      <p className="text-xs text-ink-500">{o.itemsCount} ítems · {o.createdAt.toLocaleDateString("es-AR")}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink-900">{o.customerName}</p>
                      <p className="text-xs text-ink-500">{o.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-ink-800">{o.paymentLabel || o.paymentMethod}</p>
                      <p className="text-xs text-ink-500">{o.deliveryLabel || o.deliveryMethod}</p>
                    </td>
                    <td className="px-4 py-3 font-bold text-ink-900">{money(o.total)}</td>
                    <td className="px-4 py-3">
                      <Pill tone={statusTone(o.status)}>{statusLabel(o.status)}</Pill>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-ink-500">Página {page} de {pages}</p>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link
              href={withParams({ ...base, page: String(page - 1) }, {})}
              className="rounded-xl border border-ink-200 px-4 py-2 text-xs font-bold text-ink-700"
            >
              ← Anterior
            </Link>
          ) : null}
          {page < pages ? (
            <Link
              href={withParams({ ...base, page: String(page + 1) }, {})}
              className="rounded-xl border border-ink-200 px-4 py-2 text-xs font-bold text-ink-700"
            >
              Siguiente →
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
