import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { orderItems, orders, products } from "@/db/schema";

export type AdminStats = {
  todayRevenue: number;
  todayCount: number;
  monthRevenue: number;
  monthCount: number;
  avgTicket: number;
  /** Pedidos del mes en "Pedido recibido": todavía no entró la plata. */
  monthPendingRevenue: number;
  monthPendingCount: number;
  byStatus: Record<string, number>;
  topProducts: { slug: string; name: string; units: number; revenue: number }[];
  outOfStockCount: number;
  outOfStockSample: { slug: string; name: string; price: number }[];
  recentOrders: { code: string; customerName: string; total: number; status: string; createdAt: Date }[];
};

/**
 * Estados que cuentan como venta: el pago ya se acreditó. "Pedido recibido"
 * (`pendiente_pago`) queda afuera porque la plata todavía no entró.
 */
const PAID_STATUSES = ["pago_confirmado", "preparando", "enviado", "entregado"];

/**
 * Argentina no tiene horario de verano desde 2009: UTC-3 fijo. El servidor
 * corre en UTC, así que "hoy" y "este mes" se calculan con este corrimiento
 * para que el día arranque a las 00:00 de Córdoba y no a las 21:00.
 */
const AR_OFFSET_MS = -3 * 60 * 60 * 1000;

function startOfDayAr(now: Date): Date {
  const local = new Date(now.getTime() + AR_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - AR_OFFSET_MS);
}

function startOfMonthAr(now: Date): Date {
  const local = new Date(now.getTime() + AR_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - AR_OFFSET_MS);
}

export async function getAdminStats(): Promise<AdminStats> {
  const now = new Date();
  const dayStart = startOfDayAr(now);
  const monthStart = startOfMonthAr(now);
  const paid = inArray(orders.status, PAID_STATUSES);

  const [dayRows, monthRows, pendingRows, byStatus, top, outSample, [outCount], recent] = await Promise.all([
    db
      .select({ revenue: sql<number>`coalesce(sum(${orders.total}), 0)::int`, count: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(paid, gte(orders.createdAt, dayStart))),
    db
      .select({ revenue: sql<number>`coalesce(sum(${orders.total}), 0)::int`, count: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(paid, gte(orders.createdAt, monthStart))),
    db
      .select({ revenue: sql<number>`coalesce(sum(${orders.total}), 0)::int`, count: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(eq(orders.status, "pendiente_pago"), gte(orders.createdAt, monthStart))),
    db
      .select({ status: orders.status, count: sql<number>`count(*)::int` })
      .from(orders)
      .groupBy(orders.status),
    db
      .select({
        slug: orderItems.productSlug,
        name: sql<string>`max(${orderItems.name})`,
        units: sql<number>`sum(${orderItems.quantity})::int`,
        revenue: sql<number>`sum(${orderItems.unitPrice} * ${orderItems.quantity})::int`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(paid, gte(orders.createdAt, monthStart)))
      .groupBy(orderItems.productSlug)
      .orderBy(desc(sql`sum(${orderItems.unitPrice} * ${orderItems.quantity})`))
      .limit(5),
    db
      .select({ slug: products.slug, name: products.name, price: products.price })
      .from(products)
      .where(sql`${products.stock} <= 0`)
      .orderBy(desc(products.createdAt))
      .limit(8),
    db.select({ count: sql<number>`count(*)::int` }).from(products).where(sql`${products.stock} <= 0`),
    db
      .select({
        code: orders.code,
        customerName: orders.customerName,
        total: orders.total,
        status: orders.status,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(8),
  ]);

  const day = dayRows[0] ?? { revenue: 0, count: 0 };
  const month = monthRows[0] ?? { revenue: 0, count: 0 };
  const pending = pendingRows[0] ?? { revenue: 0, count: 0 };

  return {
    todayRevenue: day.revenue,
    todayCount: day.count,
    monthRevenue: month.revenue,
    monthCount: month.count,
    avgTicket: month.count > 0 ? Math.round(month.revenue / month.count) : 0,
    monthPendingRevenue: pending.revenue,
    monthPendingCount: pending.count,
    byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s.count])),
    topProducts: top,
    outOfStockCount: outCount?.count ?? 0,
    outOfStockSample: outSample,
    recentOrders: recent,
  };
}
