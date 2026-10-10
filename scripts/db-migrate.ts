/**
 * Aplica las migraciones de `drizzle/` a la base de DATABASE_URL.
 *
 *   npm run db:migrate              # aplica lo pendiente
 *   npm run db:migrate -- --status  # solo muestra qué falta, no escribe
 *
 * Línea base: la base de producción se armó con `drizzle-kit push`, sin
 * historial. Si la base ya tiene la tabla `products` pero ninguna migración
 * registrada, la 0000 (`linea_base`, el esquema tal como estaba) se marca
 * como aplicada sin correrla, y después se aplican las siguientes.
 */
import "dotenv/config";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { Client } from "pg";

const MIGRATIONS_FOLDER = "./drizzle";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");
  const statusOnly = process.argv.includes("--status");

  const migrations = readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER });
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const exists = async (name: string) =>
      (await client.query<{ t: string | null }>("select to_regclass($1) as t", [name])).rows[0]?.t != null;

    const applied = (await exists("drizzle.__drizzle_migrations"))
      ? (await client.query<{ created_at: string }>("select created_at from drizzle.__drizzle_migrations")).rows.map(
          (r) => Number(r.created_at),
        )
      : [];
    const needsBaseline = applied.length === 0 && (await exists("public.products"));
    const last = Math.max(0, ...applied);
    const pending = migrations.filter((m, i) => !(needsBaseline && i === 0) && m.folderMillis > last);

    console.log(`[db:migrate] ${migrations.length} migraciones, ${applied.length} registradas en la base.`);
    if (needsBaseline) console.log("[db:migrate] Base existente sin historial: la 0000 (línea base) se marca como aplicada.");
    console.log(`[db:migrate] Pendientes: ${pending.length}`);
    if (statusOnly) return;

    if (needsBaseline) {
      const base = migrations[0];
      await client.query("create schema if not exists drizzle");
      await client.query(
        "create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)",
      );
      await client.query("insert into drizzle.__drizzle_migrations (hash, created_at) values ($1, $2)", [
        base.hash,
        base.folderMillis,
      ]);
    }

    await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER });
    console.log("[db:migrate] Listo.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
