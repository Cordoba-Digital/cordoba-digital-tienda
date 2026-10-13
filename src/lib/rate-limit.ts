import { sql } from "drizzle-orm";

import { db } from "@/db";

/**
 * Límite de intentos fallidos para rutas públicas que se pueden adivinar a
 * fuerza bruta (cupones, códigos de pedido, reseñas). Igual que el login del
 * admin, se guarda en la base para que valga entre todas las instancias de
 * Vercel. Solo cuentan los fallos: un cliente que acierta nunca se bloquea.
 */
export type RateLimit = { bucket: string; max: number; windowMinutes: number };

export const COUPON_LIMIT: RateLimit = { bucket: "cupon", max: 10, windowMinutes: 15 };
export const ORDER_LOOKUP_LIMIT: RateLimit = { bucket: "pedido", max: 10, windowMinutes: 15 };
export const REVIEW_LIMIT: RateLimit = { bucket: "resena", max: 10, windowMinutes: 60 };
/**
 * Consultas a Andreani (cotizaciones y sucursales que no estaban en caché) por
 * IP. Acá no cuentan fallos sino llamadas: son públicas y gastan la
 * credencial del local. Al pasarse, el checkout usa la tarifa fija.
 */
export const ANDREANI_LIMIT: RateLimit = { bucket: "andreani", max: 40, windowMinutes: 15 };

/**
 * Formularios públicos que guardan en la base o mandan un email al local
 * (arrepentimiento, newsletter). Cuentan envíos, no fallos: sin límite, un
 * script llena la casilla de consultas o la lista de suscriptores.
 */
export const FORM_LIMIT: RateLimit = { bucket: "formulario", max: 5, windowMinutes: 60 };
export const NEWSLETTER_LIMIT: RateLimit = { bucket: "newsletter", max: 5, windowMinutes: 60 };

/**
 * Pedidos creados por IP. Cada pedido reserva stock y puede gastar un uso de
 * cupón hasta que vence, así que un script no puede crear cientos. Holgado
 * para varias personas detrás de la misma IP (redes móviles, oficinas).
 */
export const CHECKOUT_LIMIT: RateLimit = { bucket: "checkout", max: 15, windowMinutes: 60 };

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      await db.execute(sql`create table if not exists rate_limit_misses (
        id serial primary key,
        bucket text not null,
        ip text not null,
        created_at timestamptz not null default now()
      )`);
      await db.execute(
        sql`create index if not exists rate_limit_misses_lookup_idx on rate_limit_misses (bucket, ip, created_at)`,
      );
    })().catch((error) => {
      tableReady = null;
      throw error;
    });
  }
  return tableReady;
}

/** IP del cliente según Vercel (`x-real-ip`, o el primer salto de `x-forwarded-for`). */
export function ipFromHeaders(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (forwarded || "desconocida").slice(0, 64);
}

/** Minutos que faltan para poder reintentar, o 0 si no está bloqueado. */
export async function blockedMinutes(limit: RateLimit, ip: string): Promise<number> {
  await ensureTable();
  const result = await db.execute<{ misses: number; oldest: string | null }>(sql`
    select count(*)::int as misses, min(created_at) as oldest
    from rate_limit_misses
    where bucket = ${limit.bucket} and ip = ${ip}
      and created_at > now() - make_interval(mins => ${limit.windowMinutes})
  `);
  const row = result.rows[0];
  if (!row || row.misses < limit.max || !row.oldest) return 0;
  const unlockAt = new Date(row.oldest).getTime() + limit.windowMinutes * 60_000;
  return Math.max(1, Math.ceil((unlockAt - Date.now()) / 60_000));
}

export async function recordMiss(limit: RateLimit, ip: string): Promise<void> {
  await ensureTable();
  await db.execute(sql`insert into rate_limit_misses (bucket, ip) values (${limit.bucket}, ${ip})`);
  // Limpieza: lo de más de un día no sirve para ningún límite.
  await db.execute(sql`delete from rate_limit_misses where created_at < now() - interval '1 day'`);
}

export function tooManyAttempts(minutes: number): Response {
  return Response.json(
    { ok: false, error: `Demasiados intentos. Probá de nuevo en ${minutes} min.` },
    { status: 429, headers: { "Retry-After": String(minutes * 60) } },
  );
}
