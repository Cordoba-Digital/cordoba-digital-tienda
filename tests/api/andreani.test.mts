/**
 * Envíos con Andreani contra una base real y una API de Andreani simulada.
 *
 * Lo que importa: el checkout cobra el precio que cotiza Andreani con las
 * medidas de los productos, cae a la tarifa fija si no puede cotizar, y el
 * panel no da de alta dos envíos para el mismo pedido.
 *
 * Uso: npm run test:api (necesita Postgres local migrado en DATABASE_URL)
 */
import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";

import { eq } from "drizzle-orm";

process.env.ADMIN_PASSWORD = "clave-de-prueba";
process.env.ANDREANI_CREDENTIAL = Buffer.from("Pyme|clave-de-prueba").toString("base64");
delete process.env.MP_ACCESS_TOKEN;

const { comprador, db, domicilio, pool, post, resetDb, schema } = await import("./db.mts");
const { POST: checkoutPOST } = await import("../../src/app/api/checkout/route");
const { POST: envioPOST } = await import("../../src/app/api/admin/orders/[code]/andreani/route");
const { createAdminSessionValue } = await import("../../src/lib/admin-auth");
const { findShippingOption } = await import("../../src/lib/shipping");

const BASE = "http://localhost:3000";
const tarifaFija = findShippingOption("5000", "standard")!.cost;

type Llamada = { ruta: string; body: unknown };
let llamadas: Llamada[] = [];
let andreaniCaido = false;
const tarifaDomicilio = 19304.4;

const fetchOriginal = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (url.hostname !== "woocommerce-api-acom.andreani.com") return fetchOriginal(input, init);
  if (andreaniCaido) throw new TypeError("fetch failed");
  const body = init?.body ? JSON.parse(String(init.body)) : null;
  llamadas.push({ ruta: url.pathname, body });
  const json = (data: unknown) => new Response(JSON.stringify({ message: "ok", response: data }), { status: 200 });
  switch (url.pathname) {
    case "/api/v1/Login":
      return json({
        accessToken: "token-de-prueba",
        clientType: "pyme",
        nombreFantasia: "Córdoba Digital",
        contratos: [
          { id: 11, numeroDeContrato: "400006709", modoDeEntregaNombre: "A domicilio" },
          { id: 12, numeroDeContrato: "400006711", modoDeEntregaNombre: "A sucursal" },
        ],
      });
    case "/api/v1/Pyme/rates":
      return json({ rates: [{ code: "estandar", total: tarifaDomicilio }, { code: "sucursal", total: 18086 }] });
    case "/api/v1/Pyme/ShippingRegistration":
      return json({ pedidoId: `PED-${llamadas.length}`, numeroInterno: "INT-1" });
    default:
      return new Response("{}", { status: 404 });
  }
}) as typeof fetch;

async function seed(slug: string, dimensions: string | null) {
  await db.insert(schema.products).values({
    slug,
    name: `Producto ${slug}`,
    brand: "Test",
    categorySlug: "test",
    price: 100_000,
    stock: 10,
    weight: "2,4 kg",
    dimensions,
  });
}

async function checkout(slug: string) {
  const res = await checkoutPOST(
    post("/api/checkout", { items: [{ slug, quantity: 1 }], customer: comprador, delivery: domicilio, payment: { method: "transferencia" } }),
  );
  const body = (await res.json()) as { ok: boolean; code: string };
  assert.equal(body.ok, true, JSON.stringify(body));
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.code, body.code));
  return order;
}

async function crearEnvio(code: string) {
  const value = await createAdminSessionValue("");
  const res = await envioPOST(
    new Request(`${BASE}/api/admin/orders/${code}/andreani`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `admin_session=${encodeURIComponent(value!)}`, origin: BASE },
      body: JSON.stringify({ accion: "crear" }),
    }),
    { params: Promise.resolve({ code }) },
  );
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

beforeEach(async () => {
  await resetDb();
  llamadas = [];
  andreaniCaido = false;
  await seed("valija", "21 x 38 x 56 cm");
  await seed("sin-medidas", null);
  await seed("valija-grande", "30 x 40 x 60 cm");
});
after(() => pool.end());

test("el checkout cobra el envío que cotiza Andreani con las medidas del producto", async () => {
  const order = await checkout("valija");
  assert.notEqual(order.shippingCost, tarifaFija);
  assert.equal(order.shippingCost, Math.round(tarifaDomicilio));
  const cotizacion = llamadas.find((l) => l.ruta === "/api/v1/Pyme/rates")?.body as {
    postal_code_destination: string;
    products: { dimensions: { width: number; height: number; depth: number; grams: number } }[];
  };
  assert.equal(cotizacion.postal_code_destination, "5000");
  assert.deepEqual(cotizacion.products[0].dimensions, { width: 38, height: 56, depth: 21, grams: 2400 });
});

test("un producto sin medidas usa la tarifa fija y no consulta a Andreani", async () => {
  const order = await checkout("sin-medidas");
  assert.equal(order.shippingCost, tarifaFija);
  assert.equal(llamadas.filter((l) => l.ruta === "/api/v1/Pyme/rates").length, 0);
});

test("si Andreani no responde, el checkout sigue con la tarifa fija", async () => {
  andreaniCaido = true;
  // Otro producto: la cotización de "valija" ya quedó en el caché de 15 minutos.
  const order = await checkout("valija-grande");
  assert.equal(order.shippingCost, tarifaFija);
});

test("el panel no da de alta el envío de un pedido sin pagar", async () => {
  const order = await checkout("valija");
  const res = await crearEnvio(order.code);
  assert.equal(res.status, 400);
  assert.equal(llamadas.filter((l) => l.ruta === "/api/v1/Pyme/ShippingRegistration").length, 0);
});

test("el panel da de alta el envío una sola vez, con el contrato a domicilio", async () => {
  const order = await checkout("valija");
  await db.update(schema.orders).set({ status: "pago_confirmado" }).where(eq(schema.orders.id, order.id));

  const [primera, segunda] = await Promise.all([crearEnvio(order.code), crearEnvio(order.code)]);
  const exitos = [primera, segunda].filter((r) => r.status === 200);
  assert.equal(exitos.length, 1, JSON.stringify([primera, segunda]));
  const altas = llamadas.filter((l) => l.ruta === "/api/v1/Pyme/ShippingRegistration");
  assert.equal(altas.length, 1);
  const alta = altas[0].body as { contract: { id_contract: number }; remito: string; recipient: { name: string; last_name: string } };
  assert.equal(alta.contract.id_contract, 11);
  assert.equal(alta.remito, order.code);
  assert.deepEqual([alta.recipient.name, alta.recipient.last_name], ["Ana", "Pérez"]);

  const [guardado] = await db.select().from(schema.orders).where(eq(schema.orders.id, order.id));
  assert.equal(guardado.andreani?.modalidad, "domicilio");
  assert.ok(guardado.andreani?.pedidoId.startsWith("PED-"));
});
