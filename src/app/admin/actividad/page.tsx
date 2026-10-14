import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyAdminSessionValue } from "@/lib/admin-session";
import { fieldLabel, listAdminActivity, type ActivityRow } from "@/lib/admin-audit";
import { activitySummary, actorName } from "@/lib/admin-actor";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const ENTITIES = [
  { id: "", label: "Todo" },
  { id: "producto", label: "Productos" },
  { id: "pedido", label: "Pedidos" },
  { id: "usuario", label: "Usuarios" },
  { id: "sesion", label: "Ingresos" },
  { id: "acceso", label: "Accesos" },
  { id: "cupon", label: "Cupones" },
  { id: "automatizacion", label: "Automatizaciones" },
  { id: "error", label: "Errores" },
];

const when = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Cordoba",
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function show(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "number") return value.toLocaleString("es-AR");
  if (Array.isArray(value)) return value.length ? `${value.length} ${value.length === 1 ? "elemento" : "elementos"}` : "ninguno";
  if (typeof value === "object") return JSON.stringify(value).slice(0, 80);
  return String(value).slice(0, 120);
}

function entityLink(row: ActivityRow): string | null {
  if (row.entityType === "producto") return `/admin/productos/${encodeURIComponent(row.entityId)}`;
  if (row.entityType === "pedido") return `/admin/pedidos/${encodeURIComponent(row.entityId)}`;
  if (row.entityType === "usuario") return `/admin/usuarios/${encodeURIComponent(row.entityId)}`;
  if (row.entityType === "acceso") return "/admin/accesos";
  if (row.entityType === "cupon") return "/admin/cupones";
  if (row.entityType === "automatizacion") return "/admin/automatizaciones";
  if (row.entityType === "error") return "/admin/errores";
  if (row.entityType === "inicio") return "/admin/inicio";
  return null;
}

export default async function AdminActivityPage({ searchParams }: { searchParams: SearchParams }) {
  const jar = await cookies();
  if (!(await verifyAdminSessionValue(jar.get(ADMIN_COOKIE)?.value))) {
    redirect("/admin/login?next=/admin/actividad");
  }
  const sp = await searchParams;
  const first = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));
  const entity = ENTITIES.some((e) => e.id === first(sp.tipo)) ? first(sp.tipo) : "";
  const actor = first(sp.quien).slice(0, 200);
  const page = Math.max(1, Number(first(sp.page)) || 1);
  const { items, total, pages, actors } = await listAdminActivity({ page, entityType: entity, actor });

  const href = (overrides: Record<string, string>) => {
    const params = new URLSearchParams({ ...(entity ? { tipo: entity } : {}), ...(actor ? { quien: actor } : {}), ...overrides });
    for (const [k, v] of [...params]) if (!v) params.delete(k);
    const q = params.toString();
    return q ? `/admin/actividad?${q}` : "/admin/actividad";
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-700">Admin · Registro</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-ink-900 sm:text-3xl">Actividad</h1>
        <p className="mt-1 text-sm text-ink-500">Quién cambió qué y cuándo. {total} movimientos.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {ENTITIES.map((e) => (
          <Link
            key={e.id || "todo"}
            href={href({ tipo: e.id, page: "" })}
            className={`border px-4 py-1.5 text-xs font-bold transition-[background-color,color,border-color,box-shadow,opacity] duration-150 ${
              entity === e.id ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200 bg-surface text-ink-600 hover:border-ink-400"
            }`}
          >
            {e.label}
          </Link>
        ))}
        {actors.length > 1 ? (
          <form action="/admin/actividad" method="get" className="ml-auto flex gap-2">
            {entity ? <input type="hidden" name="tipo" value={entity} /> : null}
            <select name="quien" defaultValue={actor} className="border border-ink-200 bg-surface px-3 py-1.5 text-xs text-ink-900">
              <option value="">Todas las personas</option>
              {actors.map((a) => (
                <option key={a} value={a}>
                  {actorName(a)}
                </option>
              ))}
            </select>
            <button type="submit" className="bg-ink-900 px-3 py-1.5 text-xs font-bold text-white">
              Ver
            </button>
          </form>
        ) : null}
      </div>

      <div className="admin-table">
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-500">Todavía no hay movimientos para este filtro.</p>
        ) : (
          <ul>
            {items.map((row) => {
              const link = entityLink(row);
              const changes = Object.entries(row.changes ?? {});
              return (
                <li key={row.id} className="grid gap-1 border-b border-ink-100 px-4 py-3 last:border-0 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-4">
                  <div className="text-xs text-ink-500">
                    <p className="font-semibold text-ink-700">{when.format(new Date(row.at))}</p>
                    <p className="truncate" title={actorName(row.actor)}>{actorName(row.actor)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-900">
                      {link ? (
                        <Link href={link} className="hover:text-brand-700 hover:underline">
                          {activitySummary(row.summary)}
                        </Link>
                      ) : (
                        activitySummary(row.summary)
                      )}
                    </p>
                    {changes.length ? (
                      <ul className="mt-1 space-y-0.5 text-xs text-ink-600">
                        {changes.map(([field, change]) => (
                          <li key={field} className="break-words">
                            <span className="font-semibold text-ink-700">{fieldLabel(field)}:</span> {show(change.from)} → {show(change.to)}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-ink-500">Página {page} de {pages}</p>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link href={href({ page: String(page - 1) })} className="border border-ink-200 px-4 py-2 text-xs font-bold text-ink-700">
              ← Anterior
            </Link>
          ) : null}
          {page < pages ? (
            <Link href={href({ page: String(page + 1) })} className="border border-ink-200 px-4 py-2 text-xs font-bold text-ink-700">
              Siguiente →
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
