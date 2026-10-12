import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { coupons, type Coupon } from "@/db/schema";
import { couponProblem, ensureCouponSchema } from "@/lib/coupons";

/** Lo que manda el formulario del panel. Montos en pesos enteros. */
export type CouponInput = {
  code?: unknown;
  kind?: unknown;
  value?: unknown;
  minSubtotal?: unknown;
  description?: unknown;
  /** `YYYY-MM-DD`: último día en que se puede usar. Vacío: no vence. */
  expiresOn?: unknown;
  /** Vacío: sin tope. */
  maxUses?: unknown;
  active?: unknown;
};

export type CouponFields = Omit<typeof coupons.$inferInsert, "usedCount" | "createdAt">;

export type CouponRow = {
  code: string;
  kind: "percent" | "fixed";
  value: number;
  minSubtotal: number;
  description: string;
  active: boolean;
  expiresOn: string;
  maxUses: number | null;
  usedCount: number;
  /** null si hoy se puede usar; si no, "inactivo", "vencido" o "agotado". */
  problem: string | null;
};

const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{2,29}$/;

function wholeNumber(raw: unknown): number | null {
  const n = typeof raw === "string" ? Number(raw.trim()) : typeof raw === "number" ? raw : NaN;
  return Number.isInteger(n) ? n : null;
}

/** Fin del día en Córdoba (UTC−3, sin horario de verano). */
export function endOfDayCordoba(isoDate: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const date = new Date(`${isoDate}T23:59:59.999-03:00`);
  // `new Date` acepta 2026-02-31 y lo corre a marzo: se compara contra lo pedido.
  if (Number.isNaN(date.getTime()) || toIsoDateCordoba(date) !== isoDate) return null;
  return date;
}

export function toIsoDateCordoba(date: Date): string {
  return new Date(date.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Valida el formulario. `code` solo se toma al crear: para editar, el código
 * va en la URL y no se puede cambiar (los pedidos lo guardan como texto).
 */
export function parseCouponInput(input: CouponInput): { ok: true; fields: CouponFields } | { ok: false; error: string } {
  const code = typeof input.code === "string" ? input.code.trim().toUpperCase() : "";
  if (!CODE_RE.test(code)) {
    return { ok: false, error: "El código va de 3 a 30 caracteres: letras, números, guion o guion bajo, sin espacios." };
  }
  const kind = input.kind === "fixed" ? "fixed" : input.kind === "percent" ? "percent" : null;
  if (!kind) return { ok: false, error: "Elegí si descuenta un porcentaje o un monto fijo." };

  const value = wholeNumber(input.value);
  if (kind === "percent" && (value === null || value < 1 || value > 100)) {
    return { ok: false, error: "El porcentaje va de 1 a 100, sin decimales." };
  }
  if (kind === "fixed" && (value === null || value < 1)) {
    return { ok: false, error: "El monto fijo tiene que ser un número entero de pesos mayor a 0." };
  }

  const minRaw = input.minSubtotal === "" || input.minSubtotal === undefined || input.minSubtotal === null ? 0 : input.minSubtotal;
  const minSubtotal = wholeNumber(minRaw);
  if (minSubtotal === null || minSubtotal < 0) return { ok: false, error: "La compra mínima tiene que ser un número entero de pesos." };

  const description = typeof input.description === "string" ? input.description.trim().slice(0, 200) : "";

  let expiresAt: Date | null = null;
  if (typeof input.expiresOn === "string" && input.expiresOn.trim()) {
    expiresAt = endOfDayCordoba(input.expiresOn.trim());
    if (!expiresAt) return { ok: false, error: "La fecha de vencimiento no es válida." };
  }

  let maxUses: number | null = null;
  if (input.maxUses !== "" && input.maxUses !== undefined && input.maxUses !== null) {
    maxUses = wholeNumber(input.maxUses);
    if (maxUses === null || maxUses < 1) return { ok: false, error: "El tope de usos tiene que ser un número entero mayor a 0, o quedar vacío." };
  }

  const active = input.active === undefined ? true : input.active === true || input.active === "true";

  return { ok: true, fields: { code, kind, value: value!, minSubtotal, description, expiresAt, maxUses, active } };
}

function toRow(coupon: Coupon): CouponRow {
  return {
    code: coupon.code,
    kind: coupon.kind === "fixed" ? "fixed" : "percent",
    value: coupon.value,
    minSubtotal: coupon.minSubtotal,
    description: coupon.description,
    active: coupon.active,
    expiresOn: coupon.expiresAt ? toIsoDateCordoba(coupon.expiresAt) : "",
    maxUses: coupon.maxUses,
    usedCount: coupon.usedCount,
    problem: couponProblem(coupon),
  };
}

export async function listAdminCoupons(): Promise<CouponRow[]> {
  await ensureCouponSchema();
  const rows = await db.select().from(coupons).orderBy(desc(coupons.createdAt), coupons.code);
  return rows.map(toRow);
}

export async function createAdminCoupon(fields: CouponFields): Promise<CouponRow | null> {
  await ensureCouponSchema();
  const [row] = await db.insert(coupons).values(fields).onConflictDoNothing().returning();
  return row ? toRow(row) : null;
}

/** Devuelve el cupón antes y después del cambio, o null si no existe. */
export async function updateAdminCoupon(
  code: string,
  fields: Omit<CouponFields, "code">,
): Promise<{ before: CouponRow; after: CouponRow } | null> {
  await ensureCouponSchema();
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(coupons).where(eq(coupons.code, code)).for("update");
    if (!before) return null;
    const [after] = await tx.update(coupons).set(fields).where(eq(coupons.code, code)).returning();
    return { before: toRow(before), after: toRow(after) };
  });
}
