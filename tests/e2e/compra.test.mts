/**
 * Una compra completa en el navegador: ficha, carrito, checkout y confirmación,
 * contra el build de producción y una base local.
 *
 * Levanta `next start` en otro puerto, siembra un producto y hace clic como un
 * cliente. Al final mira la base: el pedido tiene que estar con el precio del
 * servidor y el stock descontado.
 *
 * Uso: npm run build && npm run test:e2e (necesita Postgres local migrado en
 * DATABASE_URL). Fuera del CI, CHROMIUM_PATH apunta a un Chromium ya instalado.
 */
import assert from "node:assert/strict";
import { type ChildProcess, spawn } from "node:child_process";
import { after, before, test } from "node:test";

import { eq } from "drizzle-orm";
import { type Browser, chromium } from "playwright";

import { db, pool, resetDb, schema, seedProduct } from "../api/db.mts";

const PUERTO = Number(process.env.E2E_PORT) || 3100;
const BASE = `http://localhost:${PUERTO}`;
const PRECIO = 250_000;

let servidor: ChildProcess;
let browser: Browser;
let salidaServidor = "";

async function esperarServidor(): Promise<void> {
  const limite = Date.now() + 60_000;
  while (Date.now() < limite) {
    if (servidor.exitCode !== null) throw new Error(`next start terminó con ${servidor.exitCode}:\n${salidaServidor}`);
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {
      // Todavía no escucha.
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`next start no respondió en 60 s:\n${salidaServidor}`);
}

before(async () => {
  await resetDb();
  await seedProduct("auriculares-prueba", PRECIO, 5);

  servidor = spawn("node_modules/.bin/next", ["start", "-p", String(PUERTO)], {
    env: {
      ...process.env,
      MP_ACCESS_TOKEN: "",
      NEXT_TELEMETRY_DISABLED: "1",
      TRANSFER_CBU: "0000003100012345678901",
      TRANSFER_ALIAS: "tienda.prueba.cd",
      TRANSFER_TITULAR: "Titular de prueba",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  servidor.stdout?.on("data", (d) => (salidaServidor += d));
  servidor.stderr?.on("data", (d) => (salidaServidor += d));
  await esperarServidor();

  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
});

after(async () => {
  await browser?.close();
  servidor?.kill();
  await pool.end();
});

test("un cliente compra desde la ficha y el pedido queda en la base", async () => {
  const page = await browser.newPage();
  const erroresDePagina: string[] = [];
  page.on("pageerror", (e) => erroresDePagina.push(e.message));

  await page.goto(`${BASE}/producto/auriculares-prueba`);
  await page.getByRole("heading", { level: 1, name: "Producto auriculares-prueba" }).waitFor();
  await page.getByRole("button", { name: "Comprar ahora", exact: true }).first().click();

  await page.waitForURL(`${BASE}/carrito`);
  await page.getByRole("heading", { name: "Tu carrito", exact: true }).waitFor();
  await page.getByRole("link", { name: "Ir a finalizar la compra →" }).click();

  await page.waitForURL(`${BASE}/checkout`);
  await page.getByLabel("Nombre", { exact: true }).fill("Ana");
  await page.getByLabel("Apellidos", { exact: true }).fill("Pérez");
  await page.getByLabel(/^Email/).fill("ana@example.com");
  await page.getByLabel("Teléfono / WhatsApp").fill("351 555 1234");
  await page.getByLabel("DNI o CUIT").fill("30123456");
  // El checkout va por pasos: cada "Continuar" pliega el paso y abre el siguiente.
  await page.getByRole("button", { name: /Continuar a la entrega/ }).click();
  await page.getByRole("button", { name: /Retiro en el local/ }).click();
  await page.getByRole("button", { name: /Continuar al pago/ }).click();
  await page.getByRole("button", { name: /Transferencia bancaria/ }).click();
  // Los datos para transferir se ven antes de confirmar, sin pedirlos por WhatsApp.
  await page.getByText("Datos para transferir").waitFor();
  await page.getByText("tienda.prueba.cd").waitFor();
  await page.getByRole("checkbox", { name: /Acepto los términos/ }).check();
  await page.getByRole("button", { name: /^Confirmar pedido/ }).click();

  await page.waitForURL(/\/pedido\/CD-[A-Z2-9]{6}\?nuevo=1$/);
  // Transferencia sin pagar: no está confirmado hasta que la plata se acredita.
  // Sin el pago acreditado es una orden: el número sirve de referencia para transferir; sin "gracias".
  const code = new URL(page.url()).pathname.split("/").pop()!;
  await page.getByRole("heading", { level: 1, name: code }).waitFor();
  await page.getByText("Número de orden", { exact: true }).waitFor();
  await page.getByRole("heading", { name: "Cómo completar tu pago" }).waitFor();
  assert.equal(await page.getByText(/Gracias/).count(), 0);

  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.code, code));
  assert.ok(order, `no está el pedido ${code} en la base`);
  assert.equal(order.status, "pendiente_pago");
  assert.equal(order.deliveryMethod, "pickup");
  assert.equal(order.paymentMethod, "transferencia");
  assert.equal(order.email, "ana@example.com");
  assert.equal(order.subtotal, PRECIO);
  assert.equal(order.shippingCost, 0);
  assert.equal(order.total, PRECIO);

  const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, order.id));
  assert.deepEqual(items.map((i) => [i.productSlug, i.quantity]), [["auriculares-prueba", 1]]);

  const [producto] = await db.select().from(schema.products).where(eq(schema.products.slug, "auriculares-prueba"));
  assert.equal(producto.stock, 4);

  assert.deepEqual(erroresDePagina, []);
});

test("el carrito no muestra $0 antes de leerse y sobrevive a un almacenamiento roto", async () => {
  // El HTML del servidor no sabe qué hay en el carrito: muestra el esqueleto,
  // no la página armada con $0 que después saltaba a los ítems reales.
  const html = await (await fetch(`${BASE}/carrito`)).text();
  assert.match(html, /Cargando tu carrito/);

  const page = await browser.newPage();
  const erroresDePagina: string[] = [];
  page.on("pageerror", (e) => erroresDePagina.push(e.message));
  // Un ítem guardado sin precio (dato viejo o corrupto) y un almacenamiento que
  // no deja escribir, como Chrome con "bloquear todas las cookies".
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "cd_cart_v1",
      JSON.stringify([
        { slug: "roto", name: "Sin precio", quantity: 1, stock: 1 },
        { slug: "auriculares-prueba", name: "Producto auriculares-prueba", brand: "", image: "", price: 250000, compareAtPrice: null, stock: 5, quantity: 1, freeShipping: false },
      ]),
    );
    Storage.prototype.setItem = () => {
      throw new DOMException("bloqueado", "SecurityError");
    };
  });

  await page.goto(`${BASE}/carrito`);
  await page.getByRole("heading", { name: "Tu carrito", exact: true }).waitFor();
  await page.getByRole("link", { name: "Ir a finalizar la compra →" }).waitFor();
  assert.equal(await page.getByText("Sin precio").count(), 0);
  assert.equal(await page.getByText("NaN").count(), 0);
  assert.deepEqual(erroresDePagina, []);
  await page.close();
});

test("la tienda y el panel mandan sus headers de seguridad, sin valores repetidos", async () => {
  const tienda = await fetch(`${BASE}/producto/auriculares-prueba`);
  assert.equal(tienda.headers.get("strict-transport-security"), "max-age=63072000");
  assert.equal(tienda.headers.get("x-frame-options"), "SAMEORIGIN");
  assert.match(tienda.headers.get("content-security-policy") ?? "", /frame-ancestors 'self'/);
  assert.equal(tienda.headers.get("x-content-type-options"), "nosniff");
  assert.equal(tienda.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.match(tienda.headers.get("permissions-policy") ?? "", /camera=\(\)/);

  // El panel conserva los suyos, más estrictos. `Headers.get` junta los
  // valores repetidos con ", ", así que un header duplicado también falla acá.
  const panel = await fetch(`${BASE}/admin/login`);
  assert.equal(panel.headers.get("x-frame-options"), "DENY");
  assert.equal(panel.headers.get("referrer-policy"), "same-origin");
  assert.equal(panel.headers.get("content-security-policy"), "frame-ancestors 'none'");
  assert.equal(panel.headers.get("strict-transport-security"), "max-age=63072000");
});
