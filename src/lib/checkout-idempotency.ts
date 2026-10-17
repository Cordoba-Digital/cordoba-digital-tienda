import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { orders } from "@/db/schema";

/**
 * Clave de un intento de compra: la genera el navegador (`crypto.randomUUID`)
 * y la repite si vuelve a mandar el mismo pedido. Cualquier otra cosa se
 * ignora y el pedido se crea igual, sin protección contra duplicados.
 */
export function parseCheckoutKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const key = value.trim();
  return /^[A-Za-z0-9-]{16,64}$/.test(key) ? key : null;
}

/**
 * El pedido que ya creó esta clave, si existe. Se busca también por email para
 * que la clave sola no alcance para ver el pedido de otra persona.
 */
export async function findOrderByCheckoutKey(
  key: string,
  email: string,
): Promise<{ code: string; total: number } | null> {
  const [order] = await db
    .select({ code: orders.code, total: orders.total })
    .from(orders)
    .where(and(eq(orders.checkoutKey, key), eq(orders.email, email)))
    .limit(1);
  return order ?? null;
}

/** Postgres avisa con 23505 que otro envío con la misma clave ganó la carrera. */
export function isCheckoutKeyConflict(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current && depth < 4; depth += 1) {
    const e = current as { code?: unknown; constraint?: unknown; cause?: unknown };
    if (e.code === "23505" && e.constraint === "orders_checkout_key_idx") return true;
    current = e.cause;
  }
  return false;
}
