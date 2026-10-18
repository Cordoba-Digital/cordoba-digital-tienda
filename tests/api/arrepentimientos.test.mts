/**
 * Arrepentimientos en el panel: aparecen las solicitudes guardadas, ligadas a
 * su pedido aunque el cliente escriba el número con "#" o en minúscula.
 *
 * Uso: npm run test:api (necesita Postgres local migrado en DATABASE_URL)
 */
import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";

import { sql } from "drizzle-orm";

const { db, pool, resetDb, schema } = await import("./db.mts");
const { countRecentArrepentimientos, listArrepentimientos } = await import("../../src/lib/admin-arrepentimientos");

beforeEach(async () => {
  await resetDb();
  await db.execute(sql`truncate table arrepentimiento_requests restart identity`);
});
after(() => pool.end());

const base = { email: "ana@example.com", telefono: "351 555-1234", fechaCompra: "2026-10-01", producto: "iPhone 13" };

test("liga la solicitud a su pedido y cuenta solo las del plazo legal", async () => {
  await db.insert(schema.orders).values({
    code: "CD-TEST1",
    status: "entregado",
    customerName: "Ana Pérez",
    email: "ana@example.com",
    phone: "351 555-1234",
    deliveryMethod: "pickup",
    paymentMethod: "transferencia",
    subtotal: 1000,
    total: 1000,
  });
  await db.insert(schema.arrepentimientoRequests).values([
    { ...base, nombre: "Vieja", numeroPedido: "", createdAt: new Date("2026-01-01T12:00:00Z") },
    { ...base, nombre: "Ana Pérez", numeroPedido: "#cd-test1", createdAt: new Date("2026-10-12T12:00:00Z") },
    { ...base, nombre: "Otro", numeroPedido: "999", createdAt: new Date("2026-10-13T12:00:00Z") },
  ]);

  const { items, total } = await listArrepentimientos({ page: 1, perPage: 20 });
  assert.equal(total, 3);
  assert.deepEqual(items.map((r) => r.nombre), ["Otro", "Ana Pérez", "Vieja"]);
  assert.equal(items[1].orderCode, "CD-TEST1");
  assert.equal(items[1].orderStatus, "entregado");
  assert.equal(items[0].orderCode, null);
  assert.equal(await countRecentArrepentimientos(new Date("2026-10-13T20:00:00Z")), 2);
});
