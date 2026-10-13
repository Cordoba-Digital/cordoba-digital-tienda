/**
 * Base de pruebas para los tests de API: se vacía antes de cada caso.
 *
 * Usa DATABASE_URL, pero se niega a correr contra algo que no sea una base
 * local (localhost, 127.0.0.1 o el servicio `db` del devcontainer), para que
 * nunca se borre la base de producción por error.
 */
import { sql } from "drizzle-orm";

const url = process.env.DATABASE_URL ?? "";
const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
})();
if (!["localhost", "127.0.0.1", "db"].includes(host)) {
  throw new Error(`Los tests de API necesitan una base local en DATABASE_URL (ahora: "${host || "vacía"}").`);
}

const { db, pool } = await import("../../src/db");
const schema = await import("../../src/db/schema");

export { db, pool, schema };

export async function resetDb(): Promise<void> {
  await db.execute(
    sql`truncate table order_events, order_items, orders, products, coupons, admin_access, store_settings restart identity cascade`,
  );
  await db.execute(sql`do $$ begin if to_regclass('rate_limit_misses') is not null then truncate table rate_limit_misses; end if; end $$`);
}

export async function seedProduct(slug: string, price: number, stock: number): Promise<void> {
  await db.insert(schema.products).values({ slug, name: `Producto ${slug}`, brand: "Test", categorySlug: "test", price, stock });
}

export const comprador = {
  firstName: "Ana",
  lastName: "Pérez",
  email: "ana@example.com",
  phone: "351 555-1234",
  docId: "30123456",
};

export const domicilio = {
  method: "standard",
  zip: "5000",
  street: "27 de Abril",
  number: "180",
  city: "Córdoba",
  province: "Córdoba",
};

export function post(path: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}
