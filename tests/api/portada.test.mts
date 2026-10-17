/**
 * Carrusel de la portada: elige con las ventas pagas de los últimos 30 días,
 * solo un admin fija o saca productos, y cada cambio queda en Actividad.
 *
 * Uso: npm run test:api (necesita Postgres local migrado en DATABASE_URL)
 */
import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";

import { sql } from "drizzle-orm";

process.env.ADMIN_PASSWORD = "clave-de-prueba";
process.env.ADMIN_EMAILS = "duenio@example.com";

const { db, pool, resetDb, schema } = await import("./db.mts");
const { GET: leer, PUT: guardar } = await import("../../src/app/api/admin/portada/route");
const { getHeroPicks } = await import("../../src/lib/hero-picks-server");
const { setAutomation } = await import("../../src/lib/automations");
const { createAdminSessionValue } = await import("../../src/lib/admin-auth");

const BASE = "http://localhost:3000";

async function sesion(): Promise<string> {
  return `admin_session=${encodeURIComponent((await createAdminSessionValue("duenio@example.com"))!)}`;
}

function pedidoAdmin(body: unknown, cookie: string): Request {
  return new Request(`${BASE}/api/admin/portada`, {
    method: "PUT",
    headers: { "content-type": "application/json", cookie, origin: BASE },
    body: JSON.stringify(body),
  });
}

async function producto(slug: string, extra: Partial<typeof schema.products.$inferInsert> = {}) {
  await db.insert(schema.products).values({
    slug,
    name: `Producto ${slug}`,
    brand: "Test",
    categorySlug: "test",
    price: 100_000,
    stock: 5,
    images: ["/foto.jpg"],
    ...extra,
  });
}

let pedidos = 0;
async function venta(slug: string, quantity: number, status: string, createdAt = new Date()) {
  pedidos += 1;
  const [order] = await db
    .insert(schema.orders)
    .values({
      code: `CD-T${pedidos}`,
      status,
      customerName: "Ana",
      email: "ana@example.com",
      phone: "351",
      deliveryMethod: "pickup",
      paymentMethod: "transferencia",
      subtotal: 100_000 * quantity,
      total: 100_000 * quantity,
      createdAt,
    })
    .returning({ id: schema.orders.id });
  await db.insert(schema.orderItems).values({ orderId: order.id, productSlug: slug, name: slug, unitPrice: 100_000, quantity });
}

beforeEach(async () => {
  await resetDb();
  await db.execute(sql`truncate table admin_audit`).catch(() => undefined);
});
after(() => pool.end());

test("más vendidos cuenta solo pedidos pagos de los últimos 30 días", async () => {
  await producto("pagado");
  await producto("sin-pagar");
  await producto("viejo");
  await venta("pagado", 2, "entregado");
  await venta("sin-pagar", 10, "pendiente_pago");
  await venta("sin-pagar", 10, "cancelado");
  await venta("viejo", 10, "entregado", new Date(Date.now() - 45 * 24 * 60 * 60 * 1000));
  const picks = await getHeroPicks();
  assert.equal(picks.vendidos?.product.slug, "pagado");
  assert.equal(picks.vendidos?.product.recentUnits, 2);
});

test("no muestra productos sin stock o sin foto", async () => {
  await producto("agotado", { stock: 0, soldCount: 100 });
  await producto("sin-foto", { images: [], soldCount: 90 });
  await producto("bien");
  const picks = await getHeroPicks();
  const elegidos = Object.values(picks).flatMap((p) => (p ? [p.product.slug] : []));
  assert.deepEqual(elegidos, ["bien"]);
});

test("sin sesión no se lee ni se cambia", async () => {
  assert.equal((await leer(new Request(`${BASE}/api/admin/portada`))).status, 401);
  assert.equal((await guardar(pedidoAdmin({ pinned: {}, excluded: [] }, ""))).status, 401);
});

test("fijar un producto que no existe falla", async () => {
  const res = await guardar(pedidoAdmin({ pinned: { inicio: "no-existe" }, excluded: [] }, await sesion()));
  assert.equal(res.status, 400);
});

test("lo fijado y lo sacado por el admin manda, aun con la automatización apagada, y queda en Actividad", async () => {
  await producto("vendido", { soldCount: 50 });
  await producto("elegido");
  await producto("otro");
  const cookie = await sesion();

  let res = await guardar(pedidoAdmin({ pinned: { vendidos: "elegido" }, excluded: ["vendido"] }, cookie));
  assert.equal(res.status, 200, await res.clone().text());
  const { state } = (await res.json()) as { state: { slides: { id: string; pick: { slug: string; source: string } | null }[] } };
  assert.deepEqual(state.slides.find((s) => s.id === "vendidos")?.pick, {
    slug: "elegido",
    name: "Producto elegido",
    image: "/foto.jpg",
    price: 100_000,
    stock: 5,
    source: "fijado",
  });

  await setAutomation("portadaAutomatica", false, "test");
  const picks = await getHeroPicks();
  assert.equal(picks.vendidos?.product.slug, "elegido");
  assert.ok(Object.values(picks).every((p) => p?.product.slug !== "vendido"));

  const audit = await db.execute(sql`select summary from admin_audit where entity_id = 'carrusel'`);
  assert.match(String((audit.rows[0] as { summary: string }).summary), /fijó elegido en Más vendidos, sacó vendido/);

  // Fijar un producto sacado lo vuelve a permitir.
  res = await guardar(pedidoAdmin({ pinned: { vendidos: "elegido", inicio: "vendido" }, excluded: ["vendido"] }, cookie));
  const after = (await res.json()) as { state: { settings: { excluded: string[] } } };
  assert.deepEqual(after.state.settings.excluded, []);
});
