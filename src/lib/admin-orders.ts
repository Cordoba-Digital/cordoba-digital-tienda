import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { orderEvents, orderItems, orders } from "@/db/schema";
import { ADMIN_ORDER_STATUSES } from "@/lib/pricing";

export const ADMIN_STATUS_IDS: Set<string> = new Set(ADMIN_ORDER_STATUSES.map((s) => s.id));

export type AdminOrderRow = {
  id: number;
  code: string;
  status: string;
  customerName: string;
  email: string;
  phone: string;
  deliveryMethod: string;
  deliveryLabel: string;
  paymentMethod: string;
  paymentLabel: string;
  subtotal: number;
  shippingCost: number;
  total: number;
  trackingCode: string;
  createdAt: Date;
  itemsCount: number;
};

export async function listAdminOrders(input: { q: string; status: string; page: number; perPage: number }): Promise<{
  orders: AdminOrderRow[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
  stats: Record<string, number>;
}> {
  const q = input.q.trim();
  const status = input.status.trim();
  const page = Math.max(1, input.page || 1);
  const perPage = Math.min(50, Math.max(1, input.perPage || 20));

  const clauses = [];
  if (status && ADMIN_STATUS_IDS.has(status)) clauses.push(eq(orders.status, status));
  if (q) {
    const term = `%${q}%`;
    clauses.push(or(ilike(orders.code, term), ilike(orders.customerName, term), ilike(orders.email, term)));
  }
  const where = clauses.length ? and(...clauses) : undefined;

  const [rows, [countRow], stats] = await Promise.all([
    db
      .select({
        id: orders.id,
        code: orders.code,
        status: orders.status,
        customerName: orders.customerName,
        email: orders.email,
        phone: orders.phone,
        deliveryMethod: orders.deliveryMethod,
        deliveryLabel: orders.deliveryLabel,
        paymentMethod: orders.paymentMethod,
        paymentLabel: orders.paymentLabel,
        subtotal: orders.subtotal,
        shippingCost: orders.shippingCost,
        total: orders.total,
        trackingCode: orders.trackingCode,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt))
      .limit(perPage)
      .offset((page - 1) * perPage),
    db.select({ count: sql<number>`count(*)::int` }).from(orders).where(where),
    db.select({ status: orders.status, count: sql<number>`count(*)::int` }).from(orders).groupBy(orders.status),
  ]);

  const itemCounts = rows.length
    ? await db
        .select({ orderId: orderItems.orderId, count: sql<number>`count(*)::int` })
        .from(orderItems)
        .where(
          sql`${orderItems.orderId} in (${sql.join(
            rows.map((r) => sql`${r.id}`),
            sql`, `,
          )})`,
        )
        .groupBy(orderItems.orderId)
    : [];
  const countByOrder = new Map(itemCounts.map((r) => [r.orderId, r.count]));

  const total = countRow?.count ?? 0;
  return {
    orders: rows.map((r) => ({ ...r, itemsCount: countByOrder.get(r.id) ?? 0 })),
    total,
    page,
    perPage,
    pages: Math.max(1, Math.ceil(total / perPage)),
    stats: Object.fromEntries(stats.map((s) => [s.status, s.count])),
  };
}

export async function getAdminOrderDetail(code: string) {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  const [order] = await db.select().from(orders).where(eq(orders.code, normalized)).limit(1);
  if (!order) return null;
  const [items, events] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
    db.select().from(orderEvents).where(eq(orderEvents.orderId, order.id)).orderBy(desc(orderEvents.createdAt)).limit(50),
  ]);
  return { order, items, events };
}
