import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AdminUserDeleteButton } from "@/components/admin-user-delete-button";
import { AdminUserDisableButton } from "@/components/admin-user-disable-button";
import { Pill } from "@/components/ui";
import { ADMIN_COOKIE, verifyAdminSessionValue } from "@/lib/admin-auth";
import { getAdminUserDetail } from "@/lib/admin-users";
import { money, formatDateTime } from "@/lib/format";
import { statusLabel } from "@/lib/pricing";
import { getOrdersByEmail } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const jar = await cookies();
  if (!(await verifyAdminSessionValue(jar.get(ADMIN_COOKIE)?.value))) {
    redirect("/admin/login?next=/admin/usuarios");
  }

  const { id } = await params;
  const user = await getAdminUserDetail(Number(id));
  if (!user) notFound();

  const orders = await getOrdersByEmail(user.email);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link className="text-sm font-bold text-brand-700 underline" href="/admin/usuarios">
            ← Usuarios
          </Link>
          <h1 className="text-2xl font-black text-ink-900">{user.name || user.email}</h1>
          {user.isDisabled && <Pill tone="amber">Bloqueado</Pill>}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="admin-card space-y-1 p-4 text-sm">
          <p className="text-xs font-bold text-ink-500">Cuenta</p>
          <p className="font-bold text-ink-900">{user.email}</p>
          {user.name && <p className="text-ink-500">{user.name}</p>}
          <p className="text-xs text-ink-500">Alta: {formatDateTime(user.createdAt)}</p>
        </div>
        <div className="admin-card space-y-1 p-4 text-sm">
          <p className="text-xs font-bold text-ink-500">Compras</p>
          <p className="text-2xl font-black text-ink-900">{user.orderCount} pedidos</p>
          <p className="font-bold text-ink-500">{money(user.totalSpent)} en total</p>
        </div>
        <div className="admin-card space-y-2 p-4 text-sm">
          <p className="text-xs font-bold text-ink-500">Sesiones activas: {user.activeSessions}</p>
          {user.sessions.length === 0 ? (
            <p className="text-ink-500">Sin sesiones vigentes.</p>
          ) : (
            <ul className="space-y-1 text-xs text-ink-500">
              {user.sessions.slice(0, 5).map((s) => (
                <li key={s.id}>
                  Desde {formatDateTime(s.createdAt)} · vence {formatDateTime(s.expiresAt)}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <AdminUserDisableButton id={user.id} disabled={user.isDisabled} />
            <AdminUserDeleteButton id={user.id} label={user.name || user.email} />
          </div>
        </div>
      </div>

      <h2 className="text-lg font-black text-ink-900">Historial de pedidos</h2>
      {orders.length === 0 ? (
        <p className="admin-card p-6 text-sm text-ink-500">Todavía no compró nada con este email.</p>
      ) : (
        <div className="admin-table overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-xs text-ink-500">
                <th className="px-3 py-2">Pedido</th>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Items</th>
                <th className="px-3 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.code} className="border-b border-ink-100 last:border-0">
                  <td className="px-3 py-2 font-bold">
                    <Link className="text-brand-700 underline" href={`/admin/pedidos/${o.code}`}>
                      {o.code}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs text-ink-500">{formatDateTime(o.createdAt)}</td>
                  <td className="px-3 py-2">
                    <Pill tone={o.status === "pendiente_pago" ? "amber" : "brand"}>{statusLabel(o.status)}</Pill>
                  </td>
                  <td className="px-3 py-2">{o.itemsCount}</td>
                  <td className="px-3 py-2 font-black">{money(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
