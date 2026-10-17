import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { orderItems, orders, products } from "@/db/schema";

/**
 * Estados que cuentan como venta: el pago ya se acreditó. "Reserva creada"
 * (`pendiente_pago`) y "Cancelado" quedan afuera porque la plata no entró.
 */
export const PAID_STATUSES = ["pago_confirmado", "preparando", "enviado", "entregado"];

/** Zona horaria del negocio: los días del panel arrancan a las 00:00 de Córdoba. */
const TZ = "America/Argentina/Cordoba";

/**
 * Argentina no tiene horario de verano desde 2009: UTC-3 fijo. El servidor
 * corre en UTC, así que "hoy" se calcula con este corrimiento para que el día
 * arranque a las 00:00 de Córdoba y no a las 21:00.
 */
const AR_OFFSET_MS = -3 * 60 * 60 * 1000;

function startOfDayAr(now: Date): Date {
  const local = new Date(now.getTime() + AR_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - AR_OFFSET_MS);
}

export const RANGE_OPTIONS = [7, 30, 90] as const;
export type RangeDays = (typeof RANGE_OPTIONS)[number];

type Totals = { revenue: number; orders: number; customers: number; avgTicket: number };

export type AdminStats = {
  rangeDays: RangeDays;
  current: Totals;
  previous: Totals;
  todayRevenue: number;
  pendingRevenue: number;
  pendingCount: number;
  daily: { day: string; revenue: number; orders: number }[];
  /** Últimos 12 meses (incluye el actual), ventas pagadas. `month` = YYYY-MM. */
  monthly: { month: string; revenue: number; orders: number }[];
  byStatus: Record<string, number>;
  segments: { newCustomers: number; returningCustomers: number };
  topProducts: { slug: string; name: string; image: string; units: number; revenue: number }[];
  outOfStockCount: number;
  stockAlerts: { slug: string; name: string; image: string; stock: number }[];
  recentOrders: { code: string; customerName: string; email: string; total: number; status: string; createdAt: Date }[];
};

async function totalsBetween(from: Date, to: Date): Promise<Totals> {
  const [row] = await db
    .select({
      revenue: sql<number>`coalesce(sum(${orders.total}), 0)::int`,
      orders: sql<number>`count(*)::int`,
      customers: sql<number>`count(distinct lower(${orders.email}))::int`,
    })
    .from(orders)
    .where(and(inArray(orders.status, PAID_STATUSES), gte(orders.createdAt, from), lt(orders.createdAt, to)));
  const revenue = row?.revenue ?? 0;
  const count = row?.orders ?? 0;
  return { revenue, orders: count, customers: row?.customers ?? 0, avgTicket: count ? Math.round(revenue / count) : 0 };
}

export async function getAdminStats(rangeDays: RangeDays = 30): Promise<AdminStats> {
  const now = new Date();
  const today = startOfDayAr(now);
  // El rango incluye hoy: 30 días = hoy y los 29 anteriores.
  const start = new Date(today.getTime() - (rangeDays - 1) * 86_400_000);
  const prevStart = new Date(start.getTime() - rangeDays * 86_400_000);
  const paid = inArray(orders.status, PAID_STATUSES);

  const [current, previous, [todayRow], [pendingRow], dailyRows, byStatus, segRows, top, [outCount], alerts, recent, monthlyRows] =
    await Promise.all([
      totalsBetween(start, now),
      totalsBetween(prevStart, start),
      db
        .select({ revenue: sql<number>`coalesce(sum(${orders.total}), 0)::int` })
        .from(orders)
        .where(and(paid, gte(orders.createdAt, today))),
      db
        .select({ revenue: sql<number>`coalesce(sum(${orders.total}), 0)::int`, count: sql<number>`count(*)::int` })
        .from(orders)
        .where(eq(orders.status, "pendiente_pago")),
      db.execute<{ day: string; revenue: number; orders: number }>(sql`
        select to_char(d, 'YYYY-MM-DD') as day,
               coalesce(sum(o.total), 0)::int as revenue,
               count(o.id)::int as orders
        from generate_series(
          (${start.toISOString()}::timestamptz at time zone ${TZ})::date,
          (now() at time zone ${TZ})::date,
          interval '1 day'
        ) d
        left join orders o
          on (o.created_at at time zone ${TZ})::date = d::date
         and o.status in (${sql.join(PAID_STATUSES.map((s) => sql`${s}`), sql`, `)})
        group by d order by d
      `),
      db.select({ status: orders.status, count: sql<number>`count(*)::int` }).from(orders).groupBy(orders.status),
      // Cliente nuevo: su primera compra pagada cae dentro del rango.
      db.execute<{ is_new: boolean; n: number }>(sql`
        with firsts as (
          select lower(email) as email, min(created_at) as first_at
          from orders
          where status in (${sql.join(PAID_STATUSES.map((s) => sql`${s}`), sql`, `)})
          group by lower(email)
        )
        select (first_at >= ${start.toISOString()}::timestamptz) as is_new, count(*)::int as n
        from firsts
        where email in (
          select lower(email) from orders
          where status in (${sql.join(PAID_STATUSES.map((s) => sql`${s}`), sql`, `)})
            and created_at >= ${start.toISOString()}::timestamptz
        )
        group by 1
      `),
      db
        .select({
          slug: orderItems.productSlug,
          name: sql<string>`max(${orderItems.name})`,
          image: sql<string>`max(${orderItems.image})`,
          units: sql<number>`sum(${orderItems.quantity})::int`,
          revenue: sql<number>`sum(${orderItems.unitPrice} * ${orderItems.quantity})::int`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(and(paid, gte(orders.createdAt, start)))
        .groupBy(orderItems.productSlug)
        .orderBy(desc(sql`sum(${orderItems.unitPrice} * ${orderItems.quantity})`))
        .limit(5),
      db.select({ count: sql<number>`count(*)::int` }).from(products).where(sql`${products.stock} <= 0`),
      // Stock bajo real (2 a 5 unidades). El 1 es "hay stock" del catálogo
      // migrado, no una cantidad, así que no se alerta.
      db
        .select({ slug: products.slug, name: products.name, image: sql<string>`coalesce(${products.images}->>0, '')`, stock: products.stock })
        .from(products)
        .where(sql`${products.stock} between 2 and 5`)
        .orderBy(products.stock)
        .limit(5),
      db
        .select({
          code: orders.code,
          customerName: orders.customerName,
          email: orders.email,
          total: orders.total,
          status: orders.status,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .orderBy(desc(orders.createdAt))
        .limit(6),
      db.execute<{ month: string; revenue: number; orders: number }>(sql`
        select to_char(m, 'YYYY-MM') as month,
               coalesce(sum(o.total), 0)::int as revenue,
               count(o.id)::int as orders
        from generate_series(
          date_trunc('month', (now() at time zone ${TZ})) - interval '11 months',
          date_trunc('month', (now() at time zone ${TZ})),
          interval '1 month'
        ) m
        left join orders o
          on date_trunc('month', o.created_at at time zone ${TZ}) = m
         and o.status in (${sql.join(PAID_STATUSES.map((s) => sql`${s}`), sql`, `)})
        group by m order by m
      `),
    ]);

  const segments = { newCustomers: 0, returningCustomers: 0 };
  for (const row of segRows.rows) {
    if (row.is_new) segments.newCustomers = row.n;
    else segments.returningCustomers = row.n;
  }

  return {
    rangeDays,
    current,
    previous,
    todayRevenue: todayRow?.revenue ?? 0,
    pendingRevenue: pendingRow?.revenue ?? 0,
    pendingCount: pendingRow?.count ?? 0,
    daily: dailyRows.rows,
    monthly: monthlyRows.rows,
    byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s.count])),
    segments,
    topProducts: top,
    outOfStockCount: outCount?.count ?? 0,
    stockAlerts: alerts,
    recentOrders: recent,
  };
}

/** Pedidos esperando pago, para el contador de la barra lateral. */
export async function countPendingOrders(): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(orders).where(eq(orders.status, "pendiente_pago"));
  return row?.n ?? 0;
}
