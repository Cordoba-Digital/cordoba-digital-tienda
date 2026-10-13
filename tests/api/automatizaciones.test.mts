/**
 * Interruptores de automatización: solo un admin los cambia, cada cambio queda
 * en Actividad, "Vencer pedidos sin pago" frena el vencimiento y "Avisar al
 * cliente por email" manda un email por cada cambio de estado, una sola vez.
 *
 * Uso: npm run test:api (necesita Postgres local migrado en DATABASE_URL)
 */
import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";

import { eq, sql } from "drizzle-orm";

process.env.ADMIN_PASSWORD = "clave-de-prueba";
process.env.ADMIN_EMAILS = "duenio@example.com";
delete process.env.MP_ACCESS_TOKEN;

const { comprador, db, domicilio, pool, post, resetDb, schema, seedProduct } = await import("./db.mts");
const { POST: checkoutPOST } = await import("../../src/app/api/checkout/route");
const { GET: leer, PATCH: cambiar } = await import("../../src/app/api/admin/automations/route");
const { PATCH: editarPedido } = await import("../../src/app/api/admin/orders/[code]/route");
const { applyOrderStatus, expireStalePendingOrders } = await import("../../src/lib/order-status");
const { createAdminSessionValue } = await import("../../src/lib/admin-auth");
const { captureMailForTests } = await import("../../src/lib/mailer");

const BASE = "http://localhost:3000";
const enviados = captureMailForTests();

async function sesion(): Promise<string> {
  return `admin_session=${encodeURIComponent((await createAdminSessionValue("duenio@example.com"))!)}`;
}

function pedidoAdmin(path: string, body: unknown, cookie: string): Request {
  return new Request(`${BASE}${path}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie, origin: BASE },
    body: JSON.stringify(body),
  });
}

async function interruptor(id: string, enabled: boolean): Promise<Response> {
  return cambiar(pedidoAdmin("/api/admin/automations", { id, enabled }, await sesion()));
}

async function comprar(delivery: Record<string, unknown> = domicilio): Promise<{ id: number; code: string }> {
  const res = await checkoutPOST(
    post("/api/checkout", {
      customer: comprador,
      delivery,
      payment: { method: "transferencia" },
      items: [{ slug: "note", quantity: 1 }],
    }),
  );
  assert.equal(res.status, 200, await res.clone().text());
  const { code } = (await res.json()) as { code: string };
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.code, code));
  return { id: order.id, code };
}

async function estado(id: number): Promise<string> {
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, id));
  return order.status;
}

async function envejecer(id: number): Promise<void> {
  await db.execute(sql`update orders set created_at = now() - interval '49 hours' where id = ${id}`);
}

beforeEach(async () => {
  await resetDb();
  await db.execute(sql`truncate table admin_audit`).catch(() => undefined);
  await seedProduct("note", 1_000_000, 10);
  enviados.length = 0;
});
after(() => pool.end());

test("sin tocar nada, vencer está prendido y avisar al cliente apagado", async () => {
  const res = await leer(new Request(`${BASE}/api/admin/automations`, { headers: { cookie: await sesion() } }));
  assert.equal(res.status, 200);
  assert.deepEqual(((await res.json()) as { automations: unknown }).automations, { vencerPedidos: true, avisarCliente: false });
});

test("sin sesión no se leen ni se cambian", async () => {
  assert.equal((await leer(new Request(`${BASE}/api/admin/automations`))).status, 401);
  const res = await cambiar(pedidoAdmin("/api/admin/automations", { id: "vencerPedidos", enabled: false }, ""));
  assert.equal(res.status, 401);
  assert.equal(await expireStalePendingOrders(), 0);
  assert.equal((await db.select().from(schema.storeSettings)).length, 0);
});

test("rechaza interruptores que no existen y valores que no son sí o no", async () => {
  assert.equal((await interruptor("borrarTodo", true)).status, 400);
  const res = await cambiar(pedidoAdmin("/api/admin/automations", { id: "vencerPedidos", enabled: "false" }, await sesion()));
  assert.equal(res.status, 400);
  assert.equal((await db.select().from(schema.storeSettings)).length, 0);
});

test("con vencer apagado el pedido viejo sigue reservado; al prenderlo vence, y queda en Actividad", async () => {
  const pedido = await comprar();
  await envejecer(pedido.id);

  assert.equal((await interruptor("vencerPedidos", false)).status, 200);
  assert.equal(await expireStalePendingOrders(), 0);
  assert.equal(await estado(pedido.id), "pendiente_pago");

  assert.equal((await interruptor("vencerPedidos", true)).status, 200);
  assert.equal(await expireStalePendingOrders(), 1);
  assert.equal(await estado(pedido.id), "cancelado");

  const { rows } = await db.execute<{ summary: string; actor: string }>(
    sql`select summary, actor from admin_audit where entity_type = 'automatizacion' order by id`,
  );
  assert.deepEqual(
    rows.map((r) => r.summary),
    ['Apagó "Vencer pedidos sin pago"', 'Prendió "Vencer pedidos sin pago"'],
  );
  assert.equal(rows[0].actor, "duenio@example.com");
});

test("con avisar apagado no sale ningún email", async () => {
  const pedido = await comprar();
  const res = await editarPedido(pedidoAdmin(`/api/admin/orders/${pedido.code}`, { status: "pago_confirmado" }, await sesion()), {
    params: Promise.resolve({ code: pedido.code }),
  });
  assert.equal(res.status, 200);
  assert.equal(enviados.length, 0);
});

test("con avisar prendido, cada cambio de estado del panel le manda un email al cliente y queda en el historial", async () => {
  await interruptor("avisarCliente", true);
  const pedido = await comprar();
  const cookie = await sesion();
  for (const status of ["pago_confirmado", "preparando"]) {
    const res = await editarPedido(pedidoAdmin(`/api/admin/orders/${pedido.code}`, { status }, cookie), {
      params: Promise.resolve({ code: pedido.code }),
    });
    assert.equal(res.status, 200);
  }
  // Una nota sin cambio de estado no avisa.
  await editarPedido(pedidoAdmin(`/api/admin/orders/${pedido.code}`, { note: "Llamó el cliente" }, cookie), {
    params: Promise.resolve({ code: pedido.code }),
  });

  assert.deepEqual(
    enviados.map((m) => [m.to, m.subject]),
    [
      ["ana@example.com", `Recibimos el pago de tu pedido ${pedido.code}`],
      ["ana@example.com", `Estamos preparando tu pedido ${pedido.code}`],
    ],
  );
  const eventos = await db.select().from(schema.orderEvents).where(eq(schema.orderEvents.orderId, pedido.id));
  assert.equal(eventos.filter((e) => e.note.startsWith("Le avisamos al cliente por email")).length, 2);
});

test("un aviso repetido no manda el email dos veces", async () => {
  await interruptor("avisarCliente", true);
  const pedido = await comprar();
  const cambios = await Promise.all([
    applyOrderStatus(pedido.id, { from: "pendiente_pago", to: "pago_confirmado" }),
    applyOrderStatus(pedido.id, { from: "pendiente_pago", to: "pago_confirmado" }),
  ]);
  assert.deepEqual(cambios.sort(), [false, true]);
  assert.equal(enviados.length, 1);
});

test("el pedido vencido le avisa al cliente por qué se canceló", async () => {
  await interruptor("avisarCliente", true);
  const pedido = await comprar({ method: "pickup" });
  await envejecer(pedido.id);
  assert.equal(await expireStalePendingOrders(), 1);
  assert.equal(enviados.length, 1);
  assert.equal(enviados[0].subject, `Cancelamos tu pedido ${pedido.code}`);
  assert.match(enviados[0].text, /48 horas sin que recibiéramos el pago/);
});

test("vence todos los pedidos viejos aunque sean más que una tanda", async () => {
  const viejos = Array.from({ length: 205 }, (_, i) => ({
    code: `CD-OLD${String(i).padStart(3, "0")}`,
    status: "pendiente_pago",
    customerName: "Ana Pérez",
    email: "ana@example.com",
    phone: "351 555-1234",
    deliveryMethod: "pickup",
    paymentMethod: "transferencia",
    subtotal: 1000,
    total: 1000,
    createdAt: new Date(Date.now() - 49 * 60 * 60 * 1000),
  }));
  await db.insert(schema.orders).values(viejos);
  assert.equal(await expireStalePendingOrders(), 205);
  const quedan = await db.select({ id: schema.orders.id }).from(schema.orders).where(eq(schema.orders.status, "pendiente_pago"));
  assert.equal(quedan.length, 0);
});
