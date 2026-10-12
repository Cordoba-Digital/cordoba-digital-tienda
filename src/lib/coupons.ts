import { and, eq, gt, isNull, lt, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { coupons, type Coupon } from "@/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Crea las columnas de vencimiento y usos si faltan (son las de la migración
 * 0002). Así un deploy que llegue antes que `db:migrate` no rompe el checkout
 * con cupón ni la cancelación de pedidos. Idempotente; corre una vez por instancia.
 */
let schemaReady: Promise<void> | null = null;
export function ensureCouponSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = db
      .execute(
        sql`alter table coupons
          add column if not exists expires_at timestamptz,
          add column if not exists max_uses integer,
          add column if not exists used_count integer not null default 0,
          add column if not exists created_at timestamptz not null default now()`,
      )
      .then(() => undefined)
      .catch((error) => {
        schemaReady = null;
        throw error;
      });
  }
  return schemaReady;
}

/** Por qué un cupón no se puede usar ahora, o null si se puede. */
export function couponProblem(coupon: Pick<Coupon, "active" | "expiresAt" | "maxUses" | "usedCount">, now = new Date()): string | null {
  if (!coupon.active) return "inactivo";
  if (coupon.expiresAt && coupon.expiresAt.getTime() <= now.getTime()) return "vencido";
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) return "agotado";
  return null;
}

/**
 * Cuenta un uso del cupón dentro de la transacción del pedido. El chequeo y la
 * suma van en el mismo UPDATE: si dos clientes usan el último cupón a la vez,
 * solo uno lo consigue. Devuelve false si ya no se puede usar.
 */
export async function claimCouponUse(tx: Tx, code: string): Promise<boolean> {
  const rows = await tx
    .update(coupons)
    .set({ usedCount: sql`${coupons.usedCount} + 1` })
    .where(
      and(
        eq(coupons.code, code),
        eq(coupons.active, true),
        or(isNull(coupons.expiresAt), gt(coupons.expiresAt, sql`now()`)),
        or(isNull(coupons.maxUses), lt(coupons.usedCount, coupons.maxUses)),
      ),
    )
    .returning({ code: coupons.code });
  return rows.length > 0;
}

/** Devuelve el uso de un pedido que se cancela. */
export async function releaseCouponUse(tx: Tx, code: string): Promise<void> {
  await tx
    .update(coupons)
    .set({ usedCount: sql`greatest(${coupons.usedCount} - 1, 0)` })
    .where(eq(coupons.code, code));
}

/**
 * Vuelve a contar el uso de un pedido cancelado que se reactiva. Sin chequear
 * tope ni vencimiento: el pedido ya tenía el descuento y lo reactiva un admin.
 */
export async function restoreCouponUse(tx: Tx, code: string): Promise<void> {
  await tx
    .update(coupons)
    .set({ usedCount: sql`${coupons.usedCount} + 1` })
    .where(eq(coupons.code, code));
}

/** El cupón se agotó o venció entre la consulta y la transacción del pedido. */
export class CouponGoneError extends Error {
  constructor(readonly code: string) {
    super(`Cupón ${code} sin usos disponibles`);
  }
}
