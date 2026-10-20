/**
 * Datos personales: el cron borra teléfono, DNI y dirección de los pedidos
 * cerrados hace más de dos años, y el panel borra todo a pedido del cliente
 * (solo dueños, y nunca con pedidos en curso).
 *
 * Uso: npm run test:api (necesita Postgres local migrado en DATABASE_URL)
 */
import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";

import { eq } from "drizzle-orm";

process.env.ADMIN_PASSWORD = "clave-de-prueba";
process.env.ADMIN_EMAILS = "duenio@example.com";

const { db, pool, resetDb, schema } = await import("./db.mts");
const { createAdminSessionValue } = await import("../../src/lib/admin-auth");
const { addAdminAccess } = await import("../../src/lib/admin-access");
const { ERASED_NAME, purgeExpiredContactData } = await import("../../src/lib/data-retention");
const { POST } = await import("../../src/app/api/admin/users/suprimir/route");

const BASE = "http://localhost:3000";
const HACE_TRES_ANIOS = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000);
const DIRECCION = { street: "Av. Colón", number: "100", extra: "", city: "Córdoba", province: "Córdoba", zip: "5000" };

beforeEach(resetDb);
after(() => pool.end());

async function pedido(code: string, values: Partial<typeof schema.orders.$inferInsert> = {}) {
  await db.insert(schema.orders).values({
    code,
    status: "entregado",
    customerName: "Ana Pérez",
    email: "Ana@Example.com",
    phone: "351 555-1234",
    docId: "30111222",
    address: DIRECCION as never,
    deliveryMethod: "standard",
    paymentMethod: "transferencia",
    subtotal: 1000,
    total: 1000,
    ...values,
  });
  const [row] = await db.select().from(schema.orders).where(eq(schema.orders.code, code));
  return row;
}

async function cookie(email = ""): Promise<string> {
  const value = await createAdminSessionValue(email);
  assert.ok(value);
  return `admin_session=${encodeURIComponent(value)}`;
}

function suprimir(cookieHeader: string, email: string): Request {
  return new Request(`${BASE}/api/admin/users/suprimir`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookieHeader, origin: BASE },
    body: JSON.stringify({ email }),
  });
}

test("el cron borra contacto solo de pedidos cerrados hace más de dos años", async () => {
  await pedido("CD-VIEJO1", { statusUpdatedAt: HACE_TRES_ANIOS });
  await pedido("CD-VIEJO2", { status: "cancelado", statusUpdatedAt: HACE_TRES_ANIOS });
  await pedido("CD-NUEVO1");
  await pedido("CD-ABIERTO", { status: "preparando", statusUpdatedAt: HACE_TRES_ANIOS });
  await db.insert(schema.arrepentimientoRequests).values({
    nombre: "Ana",
    email: "ana@example.com",
    telefono: "351 555-1234",
    fechaCompra: "2023-01-01",
    producto: "Celular",
    createdAt: HACE_TRES_ANIOS,
  });

  assert.deepEqual(await purgeExpiredContactData(), { orders: 2, arrepentimientos: 1 });
  // Repetirlo no toca nada más.
  assert.deepEqual(await purgeExpiredContactData(), { orders: 0, arrepentimientos: 0 });

  const porCodigo = new Map((await db.select().from(schema.orders)).map((o) => [o.code, o]));
  for (const code of ["CD-VIEJO1", "CD-VIEJO2"]) {
    const o = porCodigo.get(code)!;
    assert.equal(o.phone, "");
    assert.equal(o.docId, "");
    assert.equal(o.address, null);
    assert.equal(o.customerName, "Ana Pérez", "nombre y email quedan para la contabilidad");
    assert.equal(o.email, "Ana@Example.com");
  }
  for (const code of ["CD-NUEVO1", "CD-ABIERTO"]) {
    assert.equal(porCodigo.get(code)!.phone, "351 555-1234");
  }
});

test("solo un dueño puede borrar los datos de un cliente", async () => {
  await addAdminAccess("empleado@example.com", "duenio@example.com");
  assert.equal((await POST(suprimir(await cookie("empleado@example.com"), "ana@example.com"))).status, 403);
  assert.equal((await POST(suprimir("", "ana@example.com"))).status, 401);
  assert.equal((await POST(suprimir(await cookie("duenio@example.com"), "no-es-un-email"))).status, 400);
});

test("con pedidos en curso no se borra nada", async () => {
  await pedido("CD-ENCURSO", { status: "enviado" });
  const res = await POST(suprimir(await cookie("duenio@example.com"), "ana@example.com"));
  assert.equal(res.status, 409);
  assert.match((await res.json()).error, /CD-ENCURSO/);
  const [o] = await db.select().from(schema.orders);
  assert.equal(o.customerName, "Ana Pérez");
});

test("la supresión borra pedidos, arrepentimientos, newsletter y cuenta del cliente", async () => {
  await pedido("CD-SUYO1", { notes: "Tocar timbre 2B" });
  await pedido("CD-OTRO1", { email: "otra@example.com", customerName: "Otra Persona" });
  await db.insert(schema.subscribers).values({ email: "ana@example.com" });
  await db.insert(schema.arrepentimientoRequests).values({
    nombre: "Ana",
    email: "ana@example.com",
    telefono: "351 555-1234",
    fechaCompra: "2026-10-01",
    producto: "Celular",
  });
  const [cuenta] = await db
    .insert(schema.users)
    .values({ googleSub: "sub-ana", email: "ana@example.com", name: "Ana" })
    .returning({ id: schema.users.id });
  await db.insert(schema.userSessions).values({ userId: cuenta.id, tokenHash: "hash-ana", expiresAt: new Date(Date.now() + 60_000) });

  const res = await POST(suprimir(await cookie(), " ANA@example.com "));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, orders: 1, arrepentimientos: 1, subscriber: true, account: true });

  const porCodigo = new Map((await db.select().from(schema.orders)).map((o) => [o.code, o]));
  const suyo = porCodigo.get("CD-SUYO1")!;
  assert.equal(suyo.customerName, ERASED_NAME);
  assert.equal(suyo.email, "");
  assert.equal(suyo.phone, "");
  assert.equal(suyo.docId, "");
  assert.equal(suyo.address, null);
  assert.equal(suyo.notes, "");
  assert.equal(suyo.total, 1000, "los montos quedan");
  assert.equal(porCodigo.get("CD-OTRO1")!.customerName, "Otra Persona");
  assert.equal((await db.select().from(schema.subscribers)).length, 0);
  assert.equal((await db.select().from(schema.arrepentimientoRequests)).length, 0);
  assert.equal((await db.select().from(schema.users)).length, 0);
  assert.equal((await db.select().from(schema.userSessions).where(eq(schema.userSessions.userId, cuenta.id))).length, 0);

  const registro = await db.select().from(schema.adminAudit);
  assert.ok(registro.some((r) => r.summary.startsWith("Borró los datos personales")));
  assert.ok(!registro.some((r) => /ana@example/i.test(r.summary)), "el registro de actividad no guarda el email borrado");
});
