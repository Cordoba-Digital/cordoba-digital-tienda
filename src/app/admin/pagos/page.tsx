import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminPaymentVerify } from "@/components/admin-payment-verify";
import { Pill } from "@/components/ui";
import { ADMIN_COOKIE, verifyAdminSessionValue } from "@/lib/admin-auth";
import { listAdminPayments, PAYMENT_FLAG_LABEL, type PaymentFlag } from "@/lib/admin-payments";
import { money } from "@/lib/format";
import { statusLabel } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const FLAGS: PaymentFlag[] = [
  "pendiente-con-preferencia",
  "sin-preferencia",
  "confirmado-sin-pago",
  "pendiente-antiguo",
];

function withParams(base: Record<string, string>, overrides: Record<string, string | null>): string {
  const params = new URLSearchParams(base);
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null || value === "") params.delete(key);
    else params.set(key, value);
  }
  const query = params.toString();
  return query ? `/admin/pagos?${query}` : "/admin/pagos";
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminPaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  const jar = await cookies();
  if (!(await verifyAdminSessionValue(jar.get(ADMIN_COOKIE)?.value))) {
    redirect("/admin/login?next=/admin/pagos");
  }

  const sp = await searchParams;
  const first = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));
  const q = first(sp.q).trim();
  const flag = first(sp.flag).trim();
  const page = Number(first(sp.page)) || 1;
  const base = { ...(q ? { q } : {}), ...(flag ? { flag } : {}) };

  const result = await listAdminPayments({ q, flag, page, perPage: 20 });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-ink-900">Pagos — Mercado Pago</h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card-surface p-4">
          <p className="text-xs font-bold text-ink-500">Pendientes de pago</p>
          <p className="text-2xl font-black text-ink-900">{result.summary.pendientes}</p>
          <p className="text-sm font-bold text-ink-500">{money(result.summary.montoPendiente)}</p>
        </div>
        <div className="card-surface p-4">
          <p className="text-xs font-bold text-ink-500">Confirmados</p>
          <p className="text-2xl font-black text-ink-900">{result.summary.confirmados}</p>
          <p className="text-sm font-bold text-ink-500">{money(result.summary.montoConfirmado)} acreditados</p>
        </div>
        <div className="card-surface p-4">
          <p className="text-xs font-bold text-ink-500">Órdenes con MP</p>
          <p className="text-2xl font-black text-ink-900">{result.total}</p>
          <Link
            className="text-sm font-bold text-brand-700 underline"
            href={withParams(base, { flag: "pendiente-con-preferencia", page: null })}
          >
            Ver los que fueron a pagar
          </Link>
        </div>
        <div className="card-surface p-4">
          <p className="text-xs font-bold text-ink-500">Conciliación</p>
          <p className="text-sm text-ink-500">
            Botón “Verificar en MP” por fila: compara el monto acreditado con el total. No modifica nada.
          </p>
        </div>
      </div>

      <form method="get" className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Código, email o cliente…"
          className="min-w-52 flex-1 rounded-xl border border-ink-200 bg-surface px-3 py-2 text-sm"
        />
        <select name="flag" defaultValue={flag} className="rounded-xl border border-ink-200 bg-surface px-3 py-2 text-sm">
          <option value="">Todos</option>
          {FLAGS.map((f) => (
            <option key={f} value={f}>
              {PAYMENT_FLAG_LABEL[f]}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-xl bg-ink-900 px-4 py-2 text-sm font-bold text-white">
          Filtrar
        </button>
      </form>

      {result.items.length === 0 ? (
        <p className="card-surface p-6 text-sm text-ink-500">
          No hay pagos con Mercado Pago para este filtro. Los pedidos con transferencia o efectivo no aparecen acá.
        </p>
      ) : (
        <div className="card-surface overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-xs text-ink-500">
                <th className="px-3 py-2">Pedido</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Preferencia / Pago</th>
                <th className="px-3 py-2">Alertas</th>
                <th className="px-3 py-2">Conciliar</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((row) => (
                <tr key={row.code} className="border-b border-ink-100 last:border-0">
                  <td className="px-3 py-2 font-bold">
                    <Link className="text-brand-700 underline" href={`/admin/pedidos/${row.code}`}>
                      {row.code}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    {row.customerName}
                    <span className="block text-xs text-ink-500">{row.email}</span>
                  </td>
                  <td className="px-3 py-2 font-black">{money(row.total)}</td>
                  <td className="px-3 py-2">
                    <Pill tone={row.status === "pendiente_pago" ? "amber" : "brand"}>
                      {statusLabel(row.status)}
                    </Pill>
                  </td>
                  <td className="px-3 py-2 text-xs text-ink-500">
                    <span className="block">Pref: {row.preferenceId ?? "—"}</span>
                    <span className="block">Pago: {row.paymentId ?? "—"}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="flex flex-wrap gap-1">
                      {row.flags.length === 0 ? (
                        <span className="text-xs text-ink-500">OK</span>
                      ) : (
                        row.flags.map((f) => (
                          <Pill key={f} tone="amber">
                            {PAYMENT_FLAG_LABEL[f]}
                          </Pill>
                        ))
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {row.paymentId ? <AdminPaymentVerify code={row.code} /> : <span className="text-xs text-ink-500">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.pages > 1 && (
        <div className="flex items-center gap-2 text-sm">
          {page > 1 && (
            <Link className="rounded-lg border border-ink-200 px-3 py-1 font-bold" href={withParams(base, { page: String(page - 1) })}>
              ← Anterior
            </Link>
          )}
          <span className="text-ink-500">
            Página {result.page} de {result.pages}
          </span>
          {page < result.pages && (
            <Link className="rounded-lg border border-ink-200 px-3 py-1 font-bold" href={withParams(base, { page: String(page + 1) })}>
              Siguiente →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
