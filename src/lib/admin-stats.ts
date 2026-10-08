import { and, desc, eq, gte, sql } from "drizzle-orm";

import { db } from "@/db";
import { orderItems, orders, products } from "@/db/schema";

export type AdminStats = {
  todayRevenue: number;
  todayCount: number;
  monthRevenue: number;
  monthCount: number;
  avgTicket: number;
  byStatus: Record<string, number>;
  topProducts: { slug: string; name: string; units: number; revenue: number }[];
  outOfStockCount: number;
  outOfStockSample: { slug: string; name: string; price: number }[];
  recentOrders: { code: string; customerName: string; total: number; status: string; createdAt: Date }[];
};

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

export async function getAdminStats(): Promise<AdminStats> {
  const now = new Date();
  const dayStart = startOfDay(now);
  const monthStart = startOfMonth(now);

  const [dayRows, monthRows, byStatus, top, outSample, [outCount], recent] = await Promise.all([
    db
      .select({ revenue: sql<number>`coalesce(sum(${orders.total}), 0)::int`, count: sql<number>`count(*)::int` })
      .from(orders)
      .where(gte(orders.createdAt, dayStart)),
    db
      .select({ revenue: sql<number>`coalesce(sum(${orders.total}), 0)::int`, count: sql<number>`count(*)::int` })
      .from(orders)
      .where(gte(orders.createdAt, monthStart)),
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
      .where(and(gte(orders.createdAt, monthStart)))
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

  return {
    todayRevenue: day.revenue,
    todayCount: day.count,
    monthRevenue: month.revenue,
    monthCount: month.count,
    avgTicket: month.count > 0 ? Math.round(month.revenue / month.count) : 0,
    byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s.count])),
    topProducts: top,
    outOfStockCount: outCount?.count ?? 0,
    outOfStockSample: outSample,
    recentOrders: recent,
  };
}
