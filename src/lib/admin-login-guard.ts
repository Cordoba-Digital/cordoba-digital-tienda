import { sql } from "drizzle-orm";

import { db } from "@/db";

/**
 * Límite de intentos del login del admin, guardado en la base para que valga
 * entre todas las instancias de Vercel (en memoria cada instancia contaría por
 * su lado). Por IP: 5 fallidos en 15 minutos bloquean esa IP. Global: 30
 * fallidos en 15 minutos bloquean el login para todos, contra ataques
 * repartidos entre muchas IPs.
 */
const WINDOW_MINUTES = 15;
const MAX_PER_IP = 5;
const MAX_GLOBAL = 30;

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      await db.execute(sql`create table if not exists admin_login_attempts (
        id serial primary key,
        ip text not null,
        created_at timestamptz not null default now()
      )`);
      await db.execute(sql`create index if not exists admin_login_attempts_ip_idx on admin_login_attempts (ip, created_at)`);
    })().catch((error) => {
      tableReady = null;
      throw error;
    });
  }
  return tableReady;
}

/** IP del cliente según Vercel (`x-real-ip`, o el primer salto de `x-forwarded-for`). */
export function clientIp(request: Request): string {
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (forwarded || "desconocida").slice(0, 64);
}

/** Minutos que faltan para poder reintentar, o 0 si no está bloqueado. */
export async function loginBlockedMinutes(ip: string): Promise<number> {
  await ensureTable();
  const result = await db.execute<{ per_ip: number; total: number; oldest_ip: string | null; oldest_all: string | null }>(sql`
    select
      count(*) filter (where ip = ${ip})::int as per_ip,
      count(*)::int as total,
      min(created_at) filter (where ip = ${ip}) as oldest_ip,
      min(created_at) as oldest_all
    from admin_login_attempts
    where created_at > now() - make_interval(mins => ${WINDOW_MINUTES})
  `);
  const row = result.rows[0];
  if (!row) return 0;
  const oldest = row.per_ip >= MAX_PER_IP ? row.oldest_ip : row.total >= MAX_GLOBAL ? row.oldest_all : null;
  if (!oldest) return 0;
  const unlockAt = new Date(oldest).getTime() + WINDOW_MINUTES * 60_000;
  return Math.max(1, Math.ceil((unlockAt - Date.now()) / 60_000));
}

export async function recordFailedLogin(ip: string): Promise<void> {
  await ensureTable();
  await db.execute(sql`insert into admin_login_attempts (ip) values (${ip})`);
  // Limpieza: lo viejo no sirve para el límite.
  await db.execute(sql`delete from admin_login_attempts where created_at < now() - interval '1 day'`);
}

export async function clearFailedLogins(ip: string): Promise<void> {
  await ensureTable();
  await db.execute(sql`delete from admin_login_attempts where ip = ${ip}`);
}
