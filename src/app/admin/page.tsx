import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";

import { AdminIcon } from "@/components/admin-icon";
import type { AdminIconName } from "@/components/admin-nav-items";
import { AdminMonthlyChart } from "@/components/admin-monthly-chart";
import { AdminSearchButton } from "@/components/admin-search-button";
import { AdminTickMeter } from "@/components/admin-tick-meter";
import { AdminAvatar, AdminPageHeader, AdminStatusBadge, adminBtn, adminChip, adminLink } from "@/components/admin-ui";
import { countRecentArrepentimientos } from "@/lib/admin-arrepentimientos";
import { ACTIONABLE_FILTER } from "@/lib/admin-orders";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyAdminSessionValue } from "@/lib/admin-session";
import { getAdminStats, RANGE_OPTIONS, type RangeDays } from "@/lib/admin-stats";
import { countOpenErrors } from "@/lib/error-log";
import { money } from "@/lib/format";
import { expireStalePendingOrders } from "@/lib/order-status";

export const dynamic = "force-dynamic";

const card = "admin-panel-card";
const cardTitle = "text-base font-semibold text-adm-fg";

const COLORS = { cobrar: "#eb6834", curso: "#e0457b", entregado: "#2fa36b" };

/** Variación contra el período anterior del mismo largo. Sin base, no se muestra. */
function Delta({ now, before }: { now: number; before: number }) {
  if (before <= 0) return null;
  const pct = Math.round(((now - before) / before) * 1000) / 10;
  const up = pct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full py-0.5 pl-1.5 pr-2 text-xs font-medium ${up ? "bg-adm-green/[0.12] text-adm-green" : "bg-adm-red/[0.12] text-adm-red"}`}
      title="Contra el período anterior"
    >
      <svg viewBox="0 0 24 24" aria-hidden className="h-[13px] w-[13px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d={up ? "m22 7-8.5 8.5-5-5L2 17M16 7h6v6" : "m22 17-8.5-8.5-5 5L2 7M16 17h6v-6"} />
      </svg>
      {up ? "+" : "−"}
      {Math.abs(pct).toLocaleString("es-AR")}%
    </span>
  );
}

/** Tarjeta de métrica: ícono de color, nombre, variación y valor grande. */
function Kpi({ icon, tint, label, value, now, before }: { icon: string; tint: string; label: string; value: string; now: number; before: number }) {
  return (
    <div className={`${card} flex min-w-0 flex-col gap-3 px-[18px] pb-4 pt-[18px]`}>
      <div className="flex items-center gap-2.5">
        <span className="adm-tint grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px]" style={{ "--c": tint } as CSSProperties}>
          <svg viewBox="0 0 24 24" aria-hidden className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <path d={icon} />
          </svg>
        </span>
        <span className="truncate text-[13px] text-adm-muted">{label}</span>
        <span className="ml-auto shrink-0">
          <Delta now={now} before={before} />
        </span>
      </div>
      <span className="admin-mono truncate text-[26px] font-medium tracking-[-0.02em] text-adm-fg">{value}</span>
      {before <= 0 ? <span className="-mt-2 text-xs text-adm-faint">Sin período anterior para comparar</span> : null}
    </div>
  );
}

/** Un estado de pedidos con su barra de rayitas (el gráfico de siempre). */
function StatusRow({ href, label, value, total, color, note }: { href: string; label: string; value: number; total: number; color: string; note?: string }) {
  return (
    <Link href={href} className="block rounded-[14px] border border-adm-fg/5 bg-adm-fg/[0.04] px-4 py-3 transition-[background-color] duration-150 hover:bg-adm-fg/[0.07]">
      <div className="flex items-baseline justify-between gap-2">
        <p className="flex items-center gap-2 text-sm text-adm-soft">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: color }} aria-hidden />
          {label}
        </p>
        <p className="admin-mono text-xl text-adm-fg">{value.toLocaleString("es-AR")}</p>
      </div>
      <div className="mt-1 flex items-baseline justify-between text-xs text-adm-faint">
        <span>{note ?? `de ${total.toLocaleString("es-AR")} pedidos`}</span>
        <span className="admin-mono">
          {value}/{total}
        </span>
      </div>
      <div className="mt-2">
        <AdminTickMeter value={value} total={total} color={color} />
      </div>
    </Link>
  );
}

function Thumb({ src }: { src: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" referrerPolicy="no-referrer" className="h-10 w-10 shrink-0 rounded-xl bg-white object-contain p-1" />
  ) : (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-adm-fg/[0.08] bg-adm-fg/[0.05] text-adm-faint">
      <AdminIcon name="productos" className="h-4 w-4" />
    </span>
  );
}

/** Barra horizontal de progreso (lista de más vendidos y stock). */
function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(4, Math.min(100, (value / max) * 100)) : 0;
  return (
    <span className="block h-2.5 w-full overflow-hidden rounded-full bg-adm-fg/[0.06]">
      <span className="block h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
    </span>
  );
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Cordoba", day: "numeric", month: "short" });
}

function todayLabel(): string {
  const text = new Date().toLocaleDateString("es-AR", { timeZone: "America/Argentina/Cordoba", weekday: "long", day: "numeric", month: "long" });
  return text.charAt(0).toUpperCase() + text.slice(1).replace(",", "");
}

type Alert = { href: string; text: string; icon: AdminIconName; color: string };

function SectionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={adminLink}>
      {children}
      <AdminIcon name="flecha" className="h-3.5 w-3.5" />
    </Link>
  );
}

const ICONS = {
  ventas: "M4 7h16v12H4zM4 7l2-3h12l2 3M9 11a3 3 0 0 0 6 0",
  pedidos: "M5 7h14l-1 13H6L5 7Zm4 0V6a3 3 0 0 1 6 0v1",
  ticket: "M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8ZM7.5 7.5h.01",
  clientes: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-6 9a6 6 0 0 1 12 0M19 8v6M22 11h-6",
};

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
  const [s, arrepentimientos, errores] = await Promise.all([getAdminStats(range), countRecentArrepentimientos(), countOpenErrors()]);

  const enCurso = (s.byStatus.pago_confirmado ?? 0) + (s.byStatus.preparando ?? 0) + (s.byStatus.enviado ?? 0);
  const porCobrar = s.byStatus.pendiente_pago ?? 0;
  const entregados = s.byStatus.entregado ?? 0;
  const activos = porCobrar + enCurso + entregados;
  const paraPreparar = (s.byStatus.pago_confirmado ?? 0) + (s.byStatus.preparando ?? 0);
  const topUnits = Math.max(0, ...s.topProducts.map((p) => p.units));
  const maxSeg = Math.max(s.segments.newCustomers, s.segments.returningCustomers, 1);
  const segTotal = s.segments.newCustomers + s.segments.returningCustomers;
  const plural = (n: number, one: string, many: string) => `${n.toLocaleString("es-AR")} ${n === 1 ? one : many}`;

  const alerts: Alert[] = [
    porCobrar > 0 && { href: "/admin/pedidos?status=pendiente_pago", text: `${plural(porCobrar, "pedido espera", "pedidos esperan")} el pago`, icon: "pagos", color: "#f5b544" },
    paraPreparar > 0 && { href: `/admin/pedidos?status=${ACTIONABLE_FILTER}`, text: `${plural(paraPreparar, "pedido para preparar", "pedidos para preparar")} o despachar`, icon: "pedidos", color: "#7fb0ff" },
    arrepentimientos > 0 && { href: "/admin/arrepentimientos", text: plural(arrepentimientos, "arrepentimiento nuevo", "arrepentimientos nuevos"), icon: "arrepentimientos", color: "#b79cff" },
    errores > 0 && { href: "/admin/errores", text: plural(errores, "error del servidor sin revisar", "errores del servidor sin revisar"), icon: "errores", color: "#ff8a8a" },
    s.outOfStockCount > 0 && { href: "/admin/productos?stock=sin", text: plural(s.outOfStockCount, "producto sin stock", "productos sin stock"), icon: "productos", color: "#7fb0ff" },
  ].filter((a): a is Alert => Boolean(a));

  return (
    <div className="flex flex-col gap-6">
      {/* En el celular la búsqueda está en la barra de arriba y los avisos en "Requiere atención". */}
      <div className="admin-enter hidden flex-wrap items-center gap-3 md:flex" style={{ "--i": 0 } as CSSProperties}>
        <AdminSearchButton />
        <span className="flex-1" />
        <details className="group relative">
          <summary
            aria-label={alerts.length ? `Avisos (${alerts.length})` : "Avisos"}
            className="relative grid h-10 w-10 cursor-pointer list-none place-items-center rounded-full border border-adm-fg/10 bg-adm-fg/[0.05] text-adm-soft hover:bg-adm-fg/[0.09] [&::-webkit-details-marker]:hidden"
          >
            <svg viewBox="0 0 24 24" aria-hidden className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            {alerts.length ? <span className="absolute right-2.5 top-[9px] h-2 w-2 rounded-full border-2 border-adm-panel bg-brand-500" aria-hidden /> : null}
          </summary>
          <div className="absolute right-0 z-20 mt-2 w-80 rounded-2xl border border-adm-fg/10 bg-adm-panel p-2 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.9)]">
            {alerts.length === 0 ? (
              <p className="px-3 py-4 text-sm text-adm-muted">Todo al día: no hay nada esperando.</p>
            ) : (
              alerts.map((a) => (
                <Link key={a.href} href={a.href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-adm-soft hover:bg-adm-fg/[0.06]">
                  <span className="adm-tint grid h-8 w-8 shrink-0 place-items-center rounded-[10px]" style={{ "--c": a.color } as CSSProperties}>
                    <AdminIcon name={a.icon} className="h-4 w-4" />
                  </span>
                  {a.text}
                </Link>
              ))
            )}
          </div>
        </details>
      </div>

      <div className="admin-enter" style={{ "--i": 0 } as CSSProperties}>
        <AdminPageHeader
          eyebrow={todayLabel()}
          title="Panel"
          description={
            <>
              Hoy llevás <span className="admin-mono text-adm-fg">{money(s.todayRevenue)}</span> en ventas pagadas.
            </>
          }
          actions={
            <>
              <details className="relative">
                <summary className={`${adminChip} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
                  <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
                  </svg>
                  Últimos {range} días
                  <svg viewBox="0 0 24 24" aria-hidden className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </summary>
                <nav aria-label="Período" className="absolute right-0 z-20 mt-2 flex w-48 flex-col rounded-2xl border border-adm-fg/10 bg-adm-panel p-1.5 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.9)]">
                  {RANGE_OPTIONS.map((r) => (
                    <Link
                      key={r}
                      href={r === 30 ? "/admin" : `/admin?rango=${r}`}
                      aria-current={r === range ? "page" : undefined}
                      className={`rounded-xl px-3 py-2 text-sm ${r === range ? "bg-brand-500/15 text-adm-accent" : "text-adm-soft hover:bg-adm-fg/[0.06]"}`}
                    >
                      Últimos {r} días
                    </Link>
                  ))}
                </nav>
              </details>
              <Link href="/admin/productos/nuevo" className={adminBtn}>
                <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Nuevo producto
              </Link>
            </>
          }
        />
      </div>

      <section aria-label="Métricas" className="admin-enter grid gap-4 sm:grid-cols-2 xl:grid-cols-4" style={{ "--i": 1 } as CSSProperties}>
        <Kpi icon={ICONS.ventas} tint="#ff7440" label="Ventas" value={money(s.current.revenue)} now={s.current.revenue} before={s.previous.revenue} />
        <Kpi icon={ICONS.pedidos} tint="#7fb0ff" label="Pedidos pagados" value={s.current.orders.toLocaleString("es-AR")} now={s.current.orders} before={s.previous.orders} />
        <Kpi icon={ICONS.ticket} tint="#ff8a8a" label="Ticket promedio" value={money(s.current.avgTicket)} now={s.current.avgTicket} before={s.previous.avgTicket} />
        <Kpi icon={ICONS.clientes} tint="#6ee79a" label="Clientes" value={s.current.customers.toLocaleString("es-AR")} now={s.current.customers} before={s.previous.customers} />
      </section>

      <div className="admin-enter grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" style={{ "--i": 2 } as CSSProperties}>
        <section className={`${card} p-5`}>
          <div className="mb-5 flex flex-wrap items-baseline gap-2">
            <h2 className={cardTitle}>Ventas por mes</h2>
            <span className="ml-auto text-[13px] text-adm-muted">Pedidos con pago acreditado, últimos 12 meses</span>
          </div>
          <AdminMonthlyChart data={s.monthly} />
        </section>

        <section className={`${card} flex flex-col gap-3 p-5`}>
          <div className="mb-1 flex items-center">
            <h2 className={cardTitle}>Pedidos por estado</h2>
            <SectionLink href="/admin/pedidos">Ver todos</SectionLink>
          </div>
          <StatusRow href="/admin/pedidos?status=pendiente_pago" label="Por cobrar" value={porCobrar} total={activos} color={COLORS.cobrar} note={`${money(s.pendingRevenue)} esperando pago`} />
          <StatusRow href="/admin/pedidos" label="En curso" value={enCurso} total={activos} color={COLORS.curso} note="pagados, sin entregar" />
          <StatusRow href="/admin/pedidos?status=entregado" label="Entregados" value={entregados} total={activos} color={COLORS.entregado} />
        </section>
      </div>

      <div className="admin-enter grid grid-cols-[minmax(0,1fr)] items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" style={{ "--i": 3 } as CSSProperties}>
        <section className={`${card} overflow-hidden`} aria-label="Últimos pedidos">
          <div className="flex items-center px-5 py-[18px]">
            <h2 className={cardTitle}>Últimos pedidos</h2>
            <SectionLink href="/admin/pedidos">Ver pedidos</SectionLink>
          </div>
          {s.recentOrders.length === 0 ? (
            <p className="border-t border-adm-fg/[0.06] px-5 py-5 text-sm text-adm-muted">Sin pedidos todavía.</p>
          ) : (
            <ul>
              {s.recentOrders.map((o) => (
                <li key={o.code}>
                  <Link
                    href={`/admin/pedidos/${o.code}`}
                    className="flex flex-wrap items-center gap-x-3.5 gap-y-2 border-t border-adm-fg/[0.06] px-5 py-3 text-sm transition-[background-color] duration-150 hover:bg-adm-fg/[0.035]"
                  >
                    <AdminAvatar name={o.customerName} />
                    <span className="flex min-w-0 flex-[1_1_170px] flex-col">
                      <span className="truncate font-medium text-adm-fg">{o.customerName}</span>
                      <span className="admin-mono text-xs text-adm-muted">{o.code}</span>
                    </span>
                    <span className="text-[13px] text-adm-muted">{formatDate(o.createdAt)}</span>
                    <AdminStatusBadge status={o.status} />
                    <span className="admin-mono min-w-24 text-right text-adm-fg">{money(o.total)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex min-w-0 flex-col gap-4">
          <section className={`${card} flex flex-col gap-4 p-5`} aria-label="Clientes">
            <div className="flex items-baseline">
              <h2 className={cardTitle}>Clientes</h2>
              <span className="ml-auto text-[13px] text-adm-muted">{plural(segTotal, "compró", "compraron")} en {range} días</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Nuevos", n: s.segments.newCustomers, from: "#f59a6b", to: "#eb6834" },
                { label: "Recurrentes", n: s.segments.returningCustomers, from: "#6fd3a5", to: "#2fa36b" },
              ].map((seg) => (
                <div key={seg.label}>
                  <p className="flex items-center gap-2 text-[13px] text-adm-muted">
                    <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: seg.to }} aria-hidden />
                    {seg.label}
                  </p>
                  <p className="admin-mono mt-0.5 text-[22px] text-adm-fg">{seg.n}</p>
                  <div className="mt-2 flex h-16 items-end">
                    <span
                      className="w-full rounded-lg"
                      style={{ height: `${Math.max(6, (seg.n / maxSeg) * 100)}%`, background: `linear-gradient(180deg, ${seg.to} 0%, ${seg.from}26 100%)` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className={`${card} flex flex-col gap-2 p-5`} aria-label="Requiere atención">
            <h2 className={`${cardTitle} mb-1.5`}>Requiere atención</h2>
            {alerts.length === 0 ? (
              <p className="text-sm text-adm-muted">Todo al día: no hay nada esperando.</p>
            ) : (
              alerts.map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  className="flex items-center gap-3 rounded-[14px] border border-adm-fg/5 bg-adm-fg/[0.04] px-3 py-2.5 text-sm text-adm-soft transition-[background-color] duration-150 hover:bg-adm-fg/[0.07]"
                >
                  <span className="adm-tint grid h-8 w-8 shrink-0 place-items-center rounded-[10px]" style={{ "--c": a.color } as CSSProperties}>
                    <AdminIcon name={a.icon} className="h-4 w-4" />
                  </span>
                  <span className="flex-1">{a.text}</span>
                  <span className="text-adm-faint">
                    <AdminIcon name="flecha" className="h-4 w-4" />
                  </span>
                </Link>
              ))
            )}
          </section>
        </div>
      </div>

      <div className="admin-enter grid gap-4 lg:grid-cols-2" style={{ "--i": 4 } as CSSProperties}>
        <section className={`${card} p-5`}>
          <div className="mb-4 flex items-center">
            <h2 className={cardTitle}>Más vendidos</h2>
            <span className="ml-auto text-[13px] text-adm-muted">últimos {range} días</span>
          </div>
          {s.topProducts.length === 0 ? (
            <p className="text-sm text-adm-muted">Todavía no hay ventas pagadas en el período.</p>
          ) : (
            <ul className="space-y-3.5">
              {s.topProducts.map((p) => (
                <li key={p.slug}>
                  <Link href={`/admin/productos/${encodeURIComponent(p.slug)}`} className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,9rem)] items-center gap-3">
                    <Thumb src={p.image} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-adm-fg">{p.name}</span>
                      <span className="admin-mono block text-xs text-adm-muted">{money(p.revenue)}</span>
                    </span>
                    <span>
                      <Bar value={p.units} max={topUnits} color={COLORS.cobrar} />
                      <span className="mt-1 flex justify-between text-[11px] text-adm-faint">
                        vendidos <span className="admin-mono text-adm-soft">{p.units}</span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={`${card} p-5`}>
          <div className="mb-4 flex items-center">
            <h2 className={cardTitle}>Stock bajo</h2>
            <SectionLink href="/admin/productos?stock=sin">{s.outOfStockCount.toLocaleString("es-AR")} sin stock</SectionLink>
          </div>
          {s.stockAlerts.length === 0 ? (
            <p className="text-sm text-adm-muted">Ningún producto con stock bajo (2 a 5 unidades).</p>
          ) : (
            <ul className="space-y-3.5">
              {s.stockAlerts.map((p) => (
                <li key={p.slug}>
                  <Link href={`/admin/productos/${encodeURIComponent(p.slug)}`} className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,9rem)] items-center gap-3">
                    <Thumb src={p.image} />
                    <span className="truncate text-sm text-adm-fg">{p.name}</span>
                    <span>
                      <Bar value={p.stock} max={5} color={p.stock <= 2 ? "#dc2626" : "#d97706"} />
                      <span className="mt-1 flex justify-between text-[11px] text-adm-faint">
                        quedan <span className="admin-mono text-adm-soft">{p.stock}/5</span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
