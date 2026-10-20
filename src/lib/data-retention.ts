import { and, eq, inArray, lt, ne, or, sql, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { arrepentimientoRequests, orders, subscribers, users, userSessions } from "@/db/schema";
import { CANCELLED_STATUS } from "@/lib/pricing";

/**
 * Datos personales de los clientes (ley 25.326). Teléfono, DNI y dirección
 * sirven para entregar el pedido: pasados {@link RETENTION_YEARS} años de que
 * se entregó o se canceló, se borran. Nombre, email y montos quedan para la
 * contabilidad. A pedido del cliente, el panel borra todo (ver
 * `erasePersonalData`).
 */
export const RETENTION_YEARS = 2;

/** Estados en los que el pedido ya no necesita los datos de contacto. */
export const CLOSED_STATUSES = ["entregado", CANCELLED_STATUS.id];

/** Nombre que queda en los pedidos de quien pidió borrar sus datos. */
export const ERASED_NAME = "Cliente eliminado";

function cutoff(now: Date): Date {
  const date = new Date(now);
  date.setFullYear(date.getFullYear() - RETENTION_YEARS);
  return date;
}

/**
 * Borra teléfono, DNI y dirección de los pedidos cerrados hace más de
 * {@link RETENTION_YEARS} años, y el teléfono de los arrepentimientos de esa
 * edad. Corre en el cron diario; repetirlo no cambia nada.
 */
export async function purgeExpiredContactData(now = new Date()): Promise<{ orders: number; arrepentimientos: number }> {
  const limit = cutoff(now);
  const cleaned = await db
    .update(orders)
    .set({ phone: "", docId: "", address: null })
    .where(
      and(
        inArray(orders.status, CLOSED_STATUSES),
        lt(orders.statusUpdatedAt, limit),
        or(ne(orders.phone, ""), ne(orders.docId, ""), isNotNull(orders.address)),
      ),
    )
    .returning({ id: orders.id });
  const requests = await db
    .update(arrepentimientoRequests)
    .set({ telefono: "" })
    .where(and(lt(arrepentimientoRequests.createdAt, limit), ne(arrepentimientoRequests.telefono, "")))
    .returning({ id: arrepentimientoRequests.id });
  return { orders: cleaned.length, arrepentimientos: requests.length };
}

export type ErasureResult =
  | { ok: true; orders: number; arrepentimientos: number; subscriber: boolean; account: boolean }
  | { ok: false; openOrders: string[] };

/**
 * Supresión a pedido del cliente: borra sus datos personales de los pedidos
 * (quedan código, productos y montos), sus arrepentimientos, la suscripción
 * al newsletter y la cuenta con sus sesiones. Si tiene pedidos en curso no
 * toca nada: esos datos hacen falta para entregarlos.
 */
export async function erasePersonalData(email: string): Promise<ErasureResult> {
  const normalized = email.trim().toLowerCase();
  const byEmail = sql`lower(${orders.email}) = ${normalized}`;
  return db.transaction(async (tx) => {
    const open = await tx
      .select({ code: orders.code })
      .from(orders)
      .where(and(byEmail, sql`${orders.status} not in (${sql.join(CLOSED_STATUSES.map((s) => sql`${s}`), sql`, `)})`));
    if (open.length) return { ok: false as const, openOrders: open.map((o) => o.code) };

    const erased = await tx
      .update(orders)
      .set({ customerName: ERASED_NAME, email: "", phone: "", docId: "", address: null, notes: "" })
      .where(byEmail)
      .returning({ id: orders.id });
    const requests = await tx
      .delete(arrepentimientoRequests)
      .where(sql`lower(${arrepentimientoRequests.email}) = ${normalized}`)
      .returning({ id: arrepentimientoRequests.id });
    const subscriber = await tx
      .delete(subscribers)
      .where(sql`lower(${subscribers.email}) = ${normalized}`)
      .returning({ id: subscribers.id });
    const accounts = await tx
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${normalized}`);
    for (const account of accounts) {
      await tx.delete(userSessions).where(eq(userSessions.userId, account.id));
      await tx.delete(users).where(eq(users.id, account.id));
    }
    return {
      ok: true as const,
      orders: erased.length,
      arrepentimientos: requests.length,
      subscriber: subscriber.length > 0,
      account: accounts.length > 0,
    };
  });
}
