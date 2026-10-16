import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminOrderSearch } from "@/components/admin-order-search";
import { AdminOrdersWipeButton } from "@/components/admin-orders-wipe-button";
import { AdminAvatar, AdminPageHeader, AdminStatusBadge } from "@/components/admin-ui";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyAdminSessionValue } from "@/lib/admin-session";
import { ACTIONABLE_STATUSES, whatsappHref } from "@/lib/admin-order-helpers";
import { ACTIONABLE_FILTER, listAdminOrders } from "@/lib/admin-orders";
import { formatAgo, formatDateTime, money } from "@/lib/format";
import { expireStalePendingOrders } from "@/lib/order-status";
import { ADMIN_ORDER_STATUSES } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const PER_PAGE = 20;

/** Nombres cortos de las pestañas, para que entren en un renglón. */
const TAB_LABELS: Record<string, string> = {
  pendiente_pago: "Recibidos",
  pago_confirmado: "Pagados",
  preparando: "Preparando",
  enviado: "En camino",
  entregado: "Entregados",
  cancelado: "Cancelados",
};

/** Lo de las últimas 24 h con la hora ("hace 3 h", "ayer 19:01"); lo anterior, solo el día ("14 oct"). */
function shortDate(date: Date): string {
  if (Date.now() - date.getTime() < 86_400_000) return formatAgo(date);
  return date.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Cordoba", day: "numeric", month: "short" }).replace(".", "");
}

/** Ícono del medio de pago: tarjeta, transferencia o efectivo. */
function paymentIcon(method: string): string {
  if (method === "transferencia") return "M4 8h14l-3-3M20 16H6l3 3";
  if (method === "efectivo") return "M3 7h18v10H3zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6 10v.01M18 14v.01";
  return "M3 6h18v12H3zM3 10h18M7 15h3";
}

/** Ícono de la entrega: retiro en el local, moto o envío. */
function deliveryIcon(method: string): string {
  if (method === "pickup") return "M3 9l1.5-5h15L21 9M3 9h18M5 12v8h14v-8M10 20v-5h4v5";
  if (method === "express") return "M13 2 4 14h7l-1 8 9-12h-7l1-8Z";
  return "M3 6h11v10H3zM14 9h4l3 3v4h-7M7.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM17.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z";
}

function LineIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 shrink-0 text-ink-400" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

/** Páginas a mostrar: la primera, la última y dos alrededor de la actual; los huecos son "…". */
function pageWindow(page: number, pages: number): (number | "…")[] {
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const sorted = [...keep].sort((x, y) => x - y);
  const out: (number | "…")[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push("…");
    out.push(n);
  });
  return out;
}

const pagerBtn = "inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-adm-fg/10 bg-adm-fg/[0.04] px-3.5 text-[13px] text-adm-soft transition-[background-color] duration-150 hover:bg-adm-fg/[0.09]";

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
  const { orders, total, pages, stats } = await listAdminOrders({ q, status, page, perPage: PER_PAGE });
  const base = { ...(q ? { q } : {}), ...(status ? { status } : {}) };
  const allCount = Object.values(stats).reduce((sum, n) => sum + n, 0);
  const actionable = ACTIONABLE_STATUSES.reduce((sum, id) => sum + (stats[id] ?? 0), 0);
  const tabs = [
    { id: "", label: "Todos", count: allCount },
    { id: ACTIONABLE_FILTER, label: "Para atender", count: actionable },
    ...ADMIN_ORDER_STATUSES.map((s) => ({ id: s.id as string, label: TAB_LABELS[s.id] ?? s.label, count: stats[s.id] ?? 0 })),
  ];
  const from = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const to = Math.min(total, page * PER_PAGE);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        eyebrow="Ventas"
        title="Pedidos"
        description={
          allCount === 0
            ? "Todavía no entró ningún pedido."
            : actionable > 0
              ? `${actionable} ${actionable === 1 ? "pedido espera" : "pedidos esperan"} que hagas algo: cobrar, preparar o despachar.`
              : "Todo al día: no hay pedidos esperando."
        }
        actions={allCount > 0 ? <AdminOrdersWipeButton /> : null}
      />

      {/* Un solo renglón: si no entran (celular, tablet), se deslizan de costado sin barra a la vista. */}
      <nav aria-label="Filtrar por estado" className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1 border-b border-adm-fg/[0.08]">
          {tabs.map((t) => {
            const active = status === t.id;
            return (
              <li key={t.id || "todos"}>
                <Link
                  href={withParams(base, { status: t.id || null, page: null })}
                  aria-current={active ? "page" : undefined}
                  className={`-mb-px inline-flex items-center gap-2 border-b-2 px-1 pb-3 pt-2 text-sm transition-colors duration-150 sm:px-2.5 ${active ? "border-brand-500 text-adm-fg" : "border-transparent text-adm-muted hover:text-adm-fg"}`}
                >
                  {t.label}
                  <span
                    className={`rounded-full px-[7px] py-px text-[11px] font-semibold tabular-nums ${t.id === ACTIONABLE_FILTER && t.count > 0 ? "bg-brand-500 text-[#14161c]" : active ? "bg-brand-500/20 text-adm-accent" : "bg-adm-fg/[0.08] text-adm-soft"}`}
                  >
                    {t.count}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex flex-wrap items-center gap-3">
        <AdminOrderSearch key={q} initial={q} status={status} />
        {q || status ? (
          <Link href="/admin/pedidos" className="px-2 text-[13px] text-adm-muted hover:text-adm-fg">
            Limpiar filtros
          </Link>
        ) : null}
      </div>

      {orders.length === 0 ? (
        <div className="admin-card px-6 py-12 text-center">
          {allCount === 0 ? (
            <>
              <p className="text-base font-semibold text-ink-900">Todavía no hay pedidos</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">
                Cuando alguien compre en la tienda, el pedido aparece acá y el número de la barra lateral te avisa cuántos esperan.
              </p>
            </>
          ) : (
            <>
              <p className="text-base font-semibold text-ink-900">No hay pedidos con este filtro</p>
              <p className="mt-1 text-sm text-ink-500">
                {q ? <>Nada coincide con “{q}”. </> : null}
                <Link href="/admin/pedidos" className="font-semibold text-brand-700 hover:underline">Ver todos los pedidos</Link>
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="admin-table">
          {/* Hasta 1280 px de ancho, una lista con lo que importa (quién, estado y total) en vez de la tabla ancha. */}
          <ul className="xl:hidden">
            {orders.map((o) => (
              <li key={o.id} className="border-t border-adm-fg/[0.06] first:border-t-0">
                <Link href={`/admin/pedidos/${o.code}`} className="flex items-start gap-3 px-4 py-3.5 active:bg-adm-fg/[0.05]">
                  <AdminAvatar name={o.customerName} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate font-medium text-adm-fg">{o.customerName}</p>
                      <p className="admin-mono shrink-0 text-adm-fg">{money(o.total)}</p>
                    </div>
                    <p className="truncate text-xs text-adm-muted">
                      <span className="admin-mono">{o.code}</span> · {o.firstItem || "—"}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <AdminStatusBadge status={o.status} />
                      <span className="shrink-0 text-xs text-adm-muted">{shortDate(o.createdAt)}</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <div className="relative hidden overflow-x-auto xl:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.06em] text-adm-faint">
                  <th className="px-4 py-3.5 font-normal">Cliente</th>
                  <th className="px-3 py-3.5 font-normal">Productos</th>
                  <th className="px-3 py-3.5 font-normal">Pago y entrega</th>
                  <th className="px-3 py-3.5 font-normal">Estado</th>
                  <th className="px-3 py-3.5 text-right font-normal">Total</th>
                  <th className="px-3 py-3.5 text-right font-normal">Fecha</th>
                  <th className="w-12 px-2 py-3.5"><span className="sr-only">WhatsApp</span></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const wa = whatsappHref(o.phone, `Hola ${o.customerName.split(" ")[0]}! Te escribimos de Córdoba Digital por tu pedido ${o.code}.`);
                  return (
                    <tr key={o.id} className="relative border-t border-adm-fg/[0.06] transition-[background-color] duration-150 hover:bg-adm-fg/[0.035]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <AdminAvatar name={o.customerName} />
                          <div className="min-w-0">
                            <Link
                              href={`/admin/pedidos/${o.code}`}
                              className="block max-w-[180px] truncate font-medium text-adm-fg after:absolute after:inset-0 after:content-[''] hover:text-adm-accent"
                            >
                              {o.customerName}
                            </Link>
                            <p className="admin-mono text-xs text-adm-muted">{o.code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-[150px] px-3 py-3">
                        <p className="truncate text-adm-soft" title={o.firstItem}>{o.firstItem || "—"}</p>
                        <p className="text-xs text-adm-muted">
                          {o.itemsCount} {o.itemsCount === 1 ? "unidad" : "unidades"}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <span className="flex items-center gap-2 text-adm-soft">
                          <LineIcon d={paymentIcon(o.paymentMethod)} />
                          {o.paymentLabel || o.paymentMethod}
                        </span>
                        <span className="mt-0.5 flex items-center gap-2 text-xs text-adm-muted">
                          <LineIcon d={deliveryIcon(o.deliveryMethod)} />
                          {o.deliveryLabel || o.deliveryMethod}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <AdminStatusBadge status={o.status} />
                      </td>
                      <td className="admin-mono whitespace-nowrap px-3 py-3 text-right text-adm-fg">{money(o.total)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-[13px] text-adm-muted" title={formatDateTime(o.createdAt)}>
                        {shortDate(o.createdAt)}
                      </td>
                      <td className="px-2 py-3 text-right">
                        {wa ? (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Escribirle a ${o.customerName} por WhatsApp`}
                            aria-label={`Escribirle a ${o.customerName} por WhatsApp`}
                            className="relative z-10 inline-grid h-8 w-8 place-items-center rounded-full border border-adm-fg/10 bg-adm-fg/[0.04] text-adm-muted hover:border-adm-green/50 hover:text-adm-green"
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
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-adm-fg/[0.06] px-5 py-3.5">
            <p className="text-[13px] text-adm-muted">
              {pages > 1 ? `Mostrando ${from}–${to} de ${total} pedidos` : `${total} ${total === 1 ? "pedido" : "pedidos"}`}
            </p>
            {pages > 1 ? (
              <nav aria-label="Páginas" className="flex flex-wrap items-center gap-1.5">
                {page > 1 ? (
                  <Link href={withParams({ ...base, page: String(page - 1) }, {})} className={pagerBtn}>
                    Anterior
                  </Link>
                ) : null}
                {pageWindow(page, pages).map((n, i) =>
                  n === "…" ? (
                    <span key={`hueco-${i}`} className="px-1 text-adm-faint">…</span>
                  ) : (
                    <Link
                      key={n}
                      href={withParams(base, { page: n === 1 ? null : String(n) })}
                      aria-current={n === page ? "page" : undefined}
                      className={`${pagerBtn} px-0 ${n === page ? "!border-brand-500/60 !bg-brand-500/20 text-adm-fg" : ""}`}
                    >
                      {n}
                    </Link>
                  ),
                )}
                {page < pages ? (
                  <Link href={withParams({ ...base, page: String(page + 1) }, {})} className={pagerBtn}>
                    Siguiente
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
