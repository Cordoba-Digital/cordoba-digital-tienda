import { and, asc, eq, gt, inArray, lt, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import { priceSchedules, products, type PriceSchedule } from "@/db/schema";

/**
 * Ofertas programadas: un precio de oferta que empieza y termina a una hora
 * exacta, para no adelantarse en eventos como el CyberMonday de CACE.
 *
 * El precio de oferta se escribe en `products.price` en el momento en que
 * empieza (y el precio que tenía pasa a ser el "antes"), así el resto de la
 * tienda, el checkout y los feeds no cambian. `applyDuePriceSchedules` hace
 * ese cambio y lo llaman:
 * - el checkout y el carrito, antes de cobrar, así el precio cobrado es
 *   siempre el de esa hora;
 * - `/api/ofertas/tick`, que pide cualquier navegador abierto en la tienda en
 *   el segundo en que algo empieza o termina (`PriceScheduleTicker`), el
 *   monitoreo de GitHub cada 15 minutos y el cron diario;
 * - el panel, al crear o cancelar una oferta.
 * Nunca se aplica antes de la hora: solo cuando `starts_at <= ahora`.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type ScheduleStatus = "programada" | "activa" | "terminada" | "cancelada";

/** Argentina no tiene horario de verano desde 2009: la hora de Córdoba es UTC-3 todo el año. */
const STORE_OFFSET = "-03:00";

/** "2026-11-02T00:00" (lo que da un `datetime-local`) en hora de Córdoba. */
export function parseStoreDateTime(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00${STORE_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Al revés: una fecha como valor de `datetime-local` en hora de Córdoba. */
export function toStoreDateTimeInput(date: Date): string {
  return new Date(date.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

/** La tabla todavía no existe (deploy antes de `db:migrate`): no hay nada programado. */
function missingTable(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "42P01" || e?.cause?.code === "42P01";
}

async function lockProduct(tx: Tx, slug: string) {
  const [row] = await tx
    .select({ price: products.price, compareAtPrice: products.compareAtPrice })
    .from(products)
    .where(eq(products.slug, slug))
    .for("update");
  return row ?? null;
}

async function startSchedule(tx: Tx, schedule: PriceSchedule, now: Date): Promise<boolean> {
  const product = await lockProduct(tx, schedule.productSlug);
  const skip = !product
    ? "No empezó: el producto ya no está en la tienda."
    : product.price <= schedule.offerPrice
      ? "No empezó: el precio del producto ya era igual o menor que el de oferta."
      : "";
  if (skip || !product) {
    await tx.update(priceSchedules).set({ status: "cancelada", endedAt: now, note: skip }).where(eq(priceSchedules.id, schedule.id));
    return false;
  }
  // El "antes" es el precio que tenía el producto hasta ese momento: nada inflado.
  await tx
    .update(products)
    .set({ price: schedule.offerPrice, compareAtPrice: product.price })
    .where(eq(products.slug, schedule.productSlug));
  await tx
    .update(priceSchedules)
    .set({ status: "activa", prevPrice: product.price, prevCompareAt: product.compareAtPrice, appliedAt: now })
    .where(eq(priceSchedules.id, schedule.id));
  return true;
}

async function endSchedule(tx: Tx, schedule: PriceSchedule, now: Date, reason = ""): Promise<boolean> {
  const product = await lockProduct(tx, schedule.productSlug);
  let note = reason;
  let restored = false;
  if (!product) {
    note = "El producto ya no está en la tienda.";
  } else if (product.price !== schedule.offerPrice || schedule.prevPrice === null) {
    // Lo cambiaron a mano durante la oferta: se respeta lo que pusieron.
    note = "No se volvió al precio anterior: lo cambiaron a mano durante la oferta.";
  } else {
    await tx
      .update(products)
      .set({ price: schedule.prevPrice, compareAtPrice: schedule.prevCompareAt })
      .where(eq(products.slug, schedule.productSlug));
    restored = true;
  }
  await tx.update(priceSchedules).set({ status: "terminada", endedAt: now, note }).where(eq(priceSchedules.id, schedule.id));
  return restored;
}

/**
 * Empieza y termina lo que corresponde a `now`. Devuelve los productos cuyo
 * precio cambió, para refrescar sus páginas. Primero termina y después
 * empieza, así una oferta que arranca a la misma hora en que termina otra del
 * mismo producto toma como "antes" el precio normal.
 */
export async function applyDuePriceSchedules(now = new Date()): Promise<{ changed: string[] }> {
  try {
    return await db.transaction(async (tx) => {
      const changed = new Set<string>();
      const ending = await tx
        .select()
        .from(priceSchedules)
        .where(and(eq(priceSchedules.status, "activa"), lte(priceSchedules.endsAt, now)))
        .orderBy(asc(priceSchedules.endsAt))
        .for("update", { skipLocked: true });
      for (const schedule of ending) {
        if (await endSchedule(tx, schedule, now)) changed.add(schedule.productSlug);
      }

      const starting = await tx
        .select()
        .from(priceSchedules)
        .where(and(eq(priceSchedules.status, "programada"), lte(priceSchedules.startsAt, now)))
        .orderBy(asc(priceSchedules.startsAt))
        .for("update", { skipLocked: true });
      for (const schedule of starting) {
        if (schedule.endsAt <= now) {
          // Nadie pasó por la tienda en todo el rango: ya no corresponde ponerla.
          await tx
            .update(priceSchedules)
            .set({ status: "terminada", endedAt: now, note: "No llegó a aplicarse: su horario pasó sin visitas a la tienda." })
            .where(eq(priceSchedules.id, schedule.id));
        } else if (await startSchedule(tx, schedule, now)) {
          changed.add(schedule.productSlug);
        }
      }
      return { changed: [...changed] };
    });
  } catch (error) {
    if (missingTable(error)) return { changed: [] };
    throw error;
  }
}

/**
 * Productos cuyo `stock` es una cantidad real aunque sea 1: los que tienen una
 * oferta programada o en curso. Para el evento, César carga ahí la cantidad
 * real, así que el 1 no es el "hay" del catálogo migrado: se muestra y se
 * descuenta como cualquier cantidad.
 *
 * Dentro de una transacción va en un savepoint: si la tabla no existe, el
 * error abortaría la transacción entera y el pedido fallaría.
 */
export async function countedStockSlugs(slugs: string[], tx?: Tx): Promise<Set<string>> {
  if (!slugs.length) return new Set();
  const query = (executor: Pick<typeof db, "selectDistinct">) =>
    executor
      .selectDistinct({ slug: priceSchedules.productSlug })
      .from(priceSchedules)
      .where(and(inArray(priceSchedules.productSlug, slugs), inArray(priceSchedules.status, ["programada", "activa"])));
  try {
    const rows = tx ? await tx.transaction((savepoint) => query(savepoint)) : await query(db);
    return new Set(rows.map((r) => r.slug));
  } catch (error) {
    if (missingTable(error)) return new Set();
    throw error;
  }
}

/** Próximo momento en que algo empieza o termina, para que el navegador vuelva a preguntar justo ahí. */
export async function nextPriceChangeAt(): Promise<Date | null> {
  try {
    const [row] = await db
      .select({
        next: sql<Date | null>`min(case when ${priceSchedules.status} = 'programada' then ${priceSchedules.startsAt} else ${priceSchedules.endsAt} end)`,
      })
      .from(priceSchedules)
      .where(inArray(priceSchedules.status, ["programada", "activa"]));
    return row?.next ? new Date(row.next) : null;
  } catch (error) {
    if (missingTable(error)) return null;
    throw error;
  }
}

export type PriceScheduleRow = PriceSchedule & { productName: string | null; currentPrice: number | null };

/** Para el panel: activas y programadas primero, después las últimas terminadas. */
export async function listPriceSchedules(): Promise<PriceScheduleRow[]> {
  try {
    const rows = await db
      .select({ schedule: priceSchedules, productName: products.name, currentPrice: products.price })
      .from(priceSchedules)
      .leftJoin(products, eq(products.slug, priceSchedules.productSlug))
      .orderBy(
        sql`case ${priceSchedules.status} when 'activa' then 0 when 'programada' then 1 else 2 end`,
        sql`case when ${priceSchedules.status} in ('activa', 'programada') then ${priceSchedules.startsAt} end asc`,
        sql`${priceSchedules.endedAt} desc nulls last`,
      )
      .limit(200);
    return rows.map((r) => ({ ...r.schedule, productName: r.productName, currentPrice: r.currentPrice }));
  } catch (error) {
    if (missingTable(error)) return [];
    throw error;
  }
}

export type PriceScheduleInput = { slug?: unknown; offerPrice?: unknown; startsAt?: unknown; endsAt?: unknown };

/** Valida y guarda una oferta nueva. No la aplica: eso lo hace `applyDuePriceSchedules`. */
export async function createPriceSchedule(
  input: PriceScheduleInput,
  createdBy: string,
  now = new Date(),
): Promise<{ ok: true; schedule: PriceSchedule } | { ok: false; error: string }> {
  const slug = typeof input.slug === "string" ? input.slug.trim() : "";
  const offerPrice = typeof input.offerPrice === "number" ? input.offerPrice : Number(input.offerPrice);
  const startsAt = parseStoreDateTime(input.startsAt);
  const endsAt = parseStoreDateTime(input.endsAt);

  if (!slug) return { ok: false, error: "Elegí el producto." };
  if (!Number.isInteger(offerPrice) || offerPrice <= 0) return { ok: false, error: "El precio de oferta tiene que ser un número entero de pesos." };
  if (!startsAt || !endsAt) return { ok: false, error: "Completá el día y la hora de inicio y de fin." };
  if (endsAt <= startsAt) return { ok: false, error: "El fin tiene que ser después del inicio." };
  if (endsAt <= now) return { ok: false, error: "El fin ya pasó." };

  const [product] = await db.select({ price: products.price }).from(products).where(eq(products.slug, slug));
  if (!product) return { ok: false, error: "No existe ese producto." };
  if (offerPrice >= product.price) {
    return { ok: false, error: "El precio de oferta tiene que ser menor que el precio actual del producto." };
  }

  const [overlap] = await db
    .select({ id: priceSchedules.id })
    .from(priceSchedules)
    .where(
      and(
        eq(priceSchedules.productSlug, slug),
        inArray(priceSchedules.status, ["programada", "activa"]),
        lt(priceSchedules.startsAt, endsAt),
        gt(priceSchedules.endsAt, startsAt),
      ),
    )
    .limit(1);
  if (overlap) return { ok: false, error: "Ese producto ya tiene una oferta programada que se superpone con ese horario." };

  const [schedule] = await db
    .insert(priceSchedules)
    .values({ productSlug: slug, offerPrice, startsAt, endsAt, createdBy })
    .returning();
  return { ok: true, schedule };
}

/** Cancela una programada, o termina ya una activa (vuelve el precio de antes). */
export async function cancelPriceSchedule(id: number, now = new Date()): Promise<{ slug: string; restored: boolean } | null> {
  return db.transaction(async (tx) => {
    const [schedule] = await tx.select().from(priceSchedules).where(eq(priceSchedules.id, id)).for("update");
    if (!schedule) return null;
    if (schedule.status === "programada") {
      await tx
        .update(priceSchedules)
        .set({ status: "cancelada", endedAt: now, note: "Cancelada desde el panel." })
        .where(eq(priceSchedules.id, id));
      return { slug: schedule.productSlug, restored: false };
    }
    if (schedule.status === "activa") {
      const restored = await endSchedule(tx, schedule, now, "Terminada antes de hora desde el panel.");
      return { slug: schedule.productSlug, restored };
    }
    return { slug: schedule.productSlug, restored: false };
  });
}
