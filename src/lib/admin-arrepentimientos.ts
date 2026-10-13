import { desc, gte, sql } from "drizzle-orm";

import { db } from "@/db";
import { arrepentimientoRequests } from "@/db/schema";

/**
 * Solicitudes del botón de arrepentimiento (/arrepentimiento). Se guardan
 * siempre; el email a consultas@ solo sale si hay SMTP, así que el panel es
 * el lugar donde no se pierden.
 */

/** Plazo legal para arrepentirse: 10 días corridos desde la entrega. */
export const ARREPENTIMIENTO_DIAS = 10;

export type AdminArrepentimiento = {
  id: number;
  nombre: string;
  email: string;
  telefono: string;
  numeroPedido: string;
  fechaCompra: string;
  producto: string;
  comentarios: string;
  createdAt: Date;
  /** Pedido de la tienda con ese número, si existe ("#CD-123" o "cd-123" también sirven). */
  orderCode: string | null;
  orderStatus: string | null;
};

export async function listArrepentimientos(input: { page: number; perPage: number }): Promise<{
  items: AdminArrepentimiento[];
  total: number;
  pages: number;
}> {
  const perPage = Math.min(50, Math.max(1, input.perPage || 20));
  const page = Math.max(1, input.page || 1);
  const r = arrepentimientoRequests;
  const [rows, [countRow]] = await Promise.all([
    db
      .select({
        id: r.id,
        nombre: r.nombre,
        email: r.email,
        telefono: r.telefono,
        numeroPedido: r.numeroPedido,
        fechaCompra: r.fechaCompra,
        producto: r.producto,
        comentarios: r.comentarios,
        createdAt: r.createdAt,
        orderCode: sql<string | null>`o.code`,
        orderStatus: sql<string | null>`o.status`,
      })
      .from(r)
      .leftJoin(
        sql`lateral (
          select code, status from orders
          where ${r.numeroPedido} <> ''
            and upper(code) = upper(regexp_replace(trim(${r.numeroPedido}), '^#\\s*', ''))
          limit 1
        ) o`,
        sql`true`,
      )
      .orderBy(desc(r.createdAt), desc(r.id))
      .limit(perPage)
      .offset((page - 1) * perPage),
    db.select({ n: sql<number>`count(*)::int` }).from(r),
  ]);
  const total = countRow?.n ?? 0;
  return { items: rows, total, pages: Math.max(1, Math.ceil(total / perPage)) };
}

/** Para el contador del menú: las que llegaron dentro del plazo legal. */
export async function countRecentArrepentimientos(now = new Date()): Promise<number> {
  const since = new Date(now.getTime() - ARREPENTIMIENTO_DIAS * 24 * 60 * 60 * 1000);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(arrepentimientoRequests)
    .where(gte(arrepentimientoRequests.createdAt, since));
  return row?.n ?? 0;
}
