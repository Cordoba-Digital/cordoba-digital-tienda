import { sql } from "drizzle-orm";

import { db } from "@/db";

/**
 * Crea `order_stock_holds` si falta, así el despliegue no depende de correr la
 * migración a mano (igual que `ensureUsdtSchema`). Idempotente; corre una vez
 * por instancia. Mismo SQL que `drizzle/0012_reserva_stock_2hs.sql`.
 */
let schemaReady: Promise<void> | null = null;
export function ensureStockHoldSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = db
      .execute(
        sql`create table if not exists order_stock_holds (
          order_id integer primary key not null,
          released_at timestamp with time zone default now() not null
        )`,
      )
      .then(() => undefined)
      .catch((error) => {
        schemaReady = null;
        throw error;
      });
  }
  return schemaReady;
}
