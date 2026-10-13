import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { withVerifiedSsl } from "./connection-url";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

/**
 * En Vercel cada instancia abre su propio pool. Con el default de `pg` (10
 * conexiones) unas pocas instancias en un pico agotan el límite de Postgres,
 * así que se topea bajo y se sueltan rápido las conexiones ociosas.
 */
const poolMax = Number(process.env.PG_POOL_MAX) || 3;

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: withVerifiedSsl(databaseUrl),
    max: poolMax,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });

// Una sola instancia por proceso: en dev sobrevive al hot reload y en
// producción evita pools duplicados si el módulo se evalúa más de una vez.
globalForDb.__arenaNextJsPostgresqlPool = pool;

export const db = drizzle(pool);
