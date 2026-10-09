import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Pill } from "@/components/ui";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyAdminSessionValue } from "@/lib/admin-session";
import { listAdminUsers } from "@/lib/admin-users";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

function withParams(base: Record<string, string>, overrides: Record<string, string | null>): string {
  const params = new URLSearchParams(base);
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null || value === "") params.delete(key);
    else params.set(key, value);
  }
  const query = params.toString();
  return query ? `/admin/usuarios?${query}` : "/admin/usuarios";
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminUsersPage({ searchParams }: { searchParams: SearchParams }) {
  const jar = await cookies();
  if (!(await verifyAdminSessionValue(jar.get(ADMIN_COOKIE)?.value))) {
    redirect("/admin/login?next=/admin/usuarios");
  }

  const sp = await searchParams;
  const first = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));
  const q = first(sp.q).trim();
  const page = Number(first(sp.page)) || 1;
  const base = { ...(q ? { q } : {}) };

  const result = await listAdminUsers({ q, page, perPage: 20 });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-ink-900">Usuarios</h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="admin-card p-4">
          <p className="text-xs font-bold text-ink-500">Cuentas con Google</p>
          <p className="text-2xl font-black text-ink-900">{result.summary.total}</p>
        </div>
        <div className="admin-card p-4">
          <p className="text-xs font-bold text-ink-500">Con compras</p>
          <p className="text-2xl font-black text-ink-900">{result.summary.withOrders}</p>
          <p className="text-sm text-ink-500">Incluye pedidos de invitado con el mismo email</p>
        </div>
        <div className="admin-card p-4">
          <p className="text-xs font-bold text-ink-500">Bloqueados</p>
          <p className="text-2xl font-black text-ink-900">{result.summary.disabled}</p>
        </div>
      </div>

      <form method="get" className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Email o nombre…"
          className="min-w-52 flex-1 border border-ink-200 bg-surface px-3 py-2 text-sm"
        />
        <button type="submit" className="bg-ink-900 px-4 py-2 text-sm font-bold text-white">
          Buscar
        </button>
      </form>

      {result.items.length === 0 ? (
        <p className="admin-table p-6 text-sm text-ink-500">Nadie coincide con esa búsqueda.</p>
      ) : (
        <div className="admin-table overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-xs text-ink-500">
                <th className="px-3 py-2">Usuario</th>
                <th className="px-3 py-2">Pedidos</th>
                <th className="px-3 py-2">Total gastado</th>
                <th className="px-3 py-2">Sesiones</th>
                <th className="px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((u) => (
                <tr key={u.id} className="border-b border-ink-100 last:border-0">
                  <td className="px-3 py-2">
                    <Link className="font-bold text-brand-700 underline" href={`/admin/usuarios/${u.id}`}>
                      {u.name || u.email}
                    </Link>
                    {u.name && <span className="block text-xs text-ink-500">{u.email}</span>}
                  </td>
                  <td className="px-3 py-2 font-black">{u.orderCount}</td>
                  <td className="px-3 py-2 font-black">{money(u.totalSpent)}</td>
                  <td className="px-3 py-2">{u.activeSessions}</td>
                  <td className="px-3 py-2">
                    {u.isDisabled ? <Pill solid tone="amber">Bloqueado</Pill> : <span className="text-xs text-ink-500">Activo</span>}
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
            <Link className="border border-ink-200 px-3 py-1 font-bold" href={withParams(base, { page: String(page - 1) })}>
              ← Anterior
            </Link>
          )}
          <span className="text-ink-500">
            Página {result.page} de {result.pages}
          </span>
          {page < result.pages && (
            <Link className="border border-ink-200 px-3 py-1 font-bold" href={withParams(base, { page: String(page + 1) })}>
              Siguiente →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
