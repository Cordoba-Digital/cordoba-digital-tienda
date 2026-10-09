import { and, count, desc, eq, ilike, or, sql, sum } from "drizzle-orm";

import { db } from "@/db";
import { orders, users, userSessions } from "@/db/schema";

export type AdminUserRow = {
  id: number;
  email: string;
  name: string;
  avatarUrl: string;
  isDisabled: boolean;
  createdAt: Date;
  orderCount: number;
  totalSpent: number;
  activeSessions: number;
};

export async function listAdminUsers(input: {
  q: string;
  page: number;
  perPage: number;
}): Promise<{
  items: AdminUserRow[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
  summary: { total: number; withOrders: number; disabled: number };
}> {
  const q = input.q.trim();
  const page = Math.max(1, input.page || 1);
  const perPage = Math.min(50, Math.max(1, input.perPage || 20));

  const clauses = [];
  if (q) {
    const term = `%${q}%`;
    const qClause = or(ilike(users.email, term), ilike(users.name, term));
    if (qClause) clauses.push(qClause);
  }
  const where = clauses.length ? and(...clauses) : undefined;

  const [userRows, [countRow]] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl,
        isDisabled: users.isDisabled,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(500),
    db.select({ n: count() }).from(users).where(where),
  ]);

  const total = countRow?.n ?? 0;

  // Agregados por email en minúsculas: matchea igual que `getOrdersByEmail`
  // (incluye pedidos hechos como invitado antes de registrarse).
  const emails = userRows.map((u) => u.email.trim().toLowerCase());
  const [orderStats, sessionStats] = await Promise.all([
    emails.length
      ? db
          .select({
            email: sql<string>`lower(${orders.email})`,
            orderCount: count(),
            totalSpent: sum(orders.total),
          })
          .from(orders)
          .where(sql`lower(${orders.email}) in (${sql.join(emails.map((e) => sql`${e}`), sql`, `)})`)
          .groupBy(sql`lower(${orders.email})`)
      : [],
    userRows.length
      ? db
          .select({ userId: userSessions.userId, n: count() })
          .from(userSessions)
          .where(
            and(
              sql`${userSessions.userId} in (${sql.join(userRows.map((u) => sql`${u.id}`), sql`, `)})`,
              sql`${userSessions.expiresAt} > now()`,
            ),
          )
          .groupBy(userSessions.userId)
      : [],
  ]);
  const spentByEmail = new Map(orderStats.map((r) => [r.email, r]));
  const sessionsByUser = new Map(sessionStats.map((r) => [r.userId, r.n]));

  const all: AdminUserRow[] = userRows.map((u) => {
    const stats = spentByEmail.get(u.email.trim().toLowerCase());
    return {
      ...u,
      orderCount: stats?.orderCount ?? 0,
      totalSpent: Number(stats?.totalSpent ?? 0),
      activeSessions: sessionsByUser.get(u.id) ?? 0,
    };
  });

  const pages = Math.max(1, Math.ceil(total / perPage));
  const items = all.slice((page - 1) * perPage, page * perPage);

  const [disabledRows] = await Promise.all([
    db.select({ n: count() }).from(users).where(where ? and(where, eq(users.isDisabled, true)) : eq(users.isDisabled, true)),
  ]);

  return {
    items,
    total,
    page,
    perPage,
    pages,
    summary: {
      total,
      withOrders: all.filter((u) => u.orderCount > 0).length,
      disabled: disabledRows[0]?.n ?? 0,
    },
  };
}

export type AdminUserDetail = AdminUserRow & {
  googleSub: string;
  updatedAt: Date;
  sessions: { id: number; createdAt: Date; expiresAt: Date }[];
};

export async function getAdminUserDetail(id: number): Promise<AdminUserDetail | null> {
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!u) return null;
  const normalized = u.email.trim().toLowerCase();
  const [[orderStat], sessionRows] = await Promise.all([
    db
      .select({ orderCount: count(), totalSpent: sum(orders.total) })
      .from(orders)
      .where(sql`lower(${orders.email}) = ${normalized}`),
    db
      .select({ id: userSessions.id, createdAt: userSessions.createdAt, expiresAt: userSessions.expiresAt })
      .from(userSessions)
      .where(and(eq(userSessions.userId, u.id), sql`${userSessions.expiresAt} > now()`))
      .orderBy(desc(userSessions.createdAt)),
  ]);
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatarUrl: u.avatarUrl,
    isDisabled: u.isDisabled,
    createdAt: u.createdAt,
    googleSub: u.googleSub,
    updatedAt: u.updatedAt,
    orderCount: orderStat?.orderCount ?? 0,
    totalSpent: Number(orderStat?.totalSpent ?? 0),
    activeSessions: sessionRows.length,
    sessions: sessionRows,
  };
}

export async function setUserDisabled(id: number, disabled: boolean): Promise<boolean> {
  const updated = await db
    .update(users)
    .set({ isDisabled: disabled, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning({ id: users.id });
  return updated.length > 0;
}
