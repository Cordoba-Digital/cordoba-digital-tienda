import { sql } from "drizzle-orm";

import { db } from "@/db";

/**
 * Crea `usdt_payments` si falta, así el despliegue no depende de correr la
 * migración a mano (igual que `ensureOrderStockSchema`). Idempotente; corre
 * una vez por instancia. Mismo SQL que `drizzle/0011_pagos_usdt.sql`.
 */
let schemaReady: Promise<void> | null = null;
export function ensureUsdtSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.execute(sql`create table if not exists usdt_payments (
        order_id integer primary key not null,
        expected_amount text not null,
        rate text not null,
        rate_at timestamp with time zone not null,
        txid text,
        transfer jsonb,
        created_at timestamp with time zone default now() not null,
        verified_at timestamp with time zone
      )`);
      await db.execute(sql`create unique index if not exists usdt_payments_txid_idx on usdt_payments using btree (txid)`);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}
