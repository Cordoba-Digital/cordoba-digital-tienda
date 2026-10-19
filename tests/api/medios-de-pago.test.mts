/**
 * Medios de pago: la cuenta a la que transfieren los clientes se cambia desde
 * el panel, solo la cambian los dueños, queda en Actividad, avisa por email y
 * el checkout la usa en vez de las variables de Vercel.
 *
 * Uso: npm run test:api (necesita Postgres local migrado en DATABASE_URL)
 */
import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";

import { sql } from "drizzle-orm";

process.env.ADMIN_PASSWORD = "clave-de-prueba";
process.env.ADMIN_EMAILS = "duenio@example.com";
process.env.TRANSFER_CBU = "2850590940090418135201";
process.env.TRANSFER_ALIAS = "cuenta.vercel";
process.env.TRANSFER_TITULAR = "Titular Vercel";

const { db, pool, resetDb } = await import("./db.mts");
const { GET: leer, PUT: guardar } = await import("../../src/app/api/admin/payment-methods/route");
const { createAdminSessionValue } = await import("../../src/lib/admin-auth");
const { addAdminAccess } = await import("../../src/lib/admin-access");
const { captureMailForTests } = await import("../../src/lib/mailer");
const { getTransferAccount } = await import("../../src/lib/transfer-account-server");

const BASE = "http://localhost:3000";
const enviados = captureMailForTests();

const cuenta = { number: "0000003100000123456784", alias: "mi.alias", holder: "Juana Pérez", cuit: "" };

async function cookie(email: string): Promise<string> {
  return `admin_session=${encodeURIComponent((await createAdminSessionValue(email))!)}`;
}

function put(body: unknown, cookieHeader: string): Request {
  return new Request(`${BASE}/api/admin/payment-methods`, {
    method: "PUT",
    headers: { "content-type": "application/json", cookie: cookieHeader, origin: BASE },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  await resetDb();
  await db.execute(sql`truncate table admin_audit`).catch(() => undefined);
  enviados.length = 0;
});
after(() => pool.end());

test("sin nada guardado en el panel, el checkout usa las variables de Vercel", async () => {
  const account = await getTransferAccount();
  assert.equal(account?.alias, "cuenta.vercel");
  const res = await leer(new Request(`${BASE}/api/admin/payment-methods`, { headers: { cookie: await cookie("duenio@example.com") } }));
  assert.equal(res.status, 200);
  assert.equal(((await res.json()) as { transfer: unknown }).transfer, null);
});

test("un dueño cambia la cuenta: el checkout la usa, queda en Actividad y llega el aviso", async () => {
  const res = await guardar(put(cuenta, await cookie("duenio@example.com")));
  assert.equal(res.status, 200, await res.clone().text());

  const account = await getTransferAccount();
  assert.deepEqual(account, { numberLabel: "CVU", number: cuenta.number, alias: "mi.alias", holder: "Juana Pérez", cuit: "" });

  const audit = await db.execute(sql`select actor, entity_type, changes from admin_audit`);
  assert.equal(audit.rows.length, 1);
  const row = audit.rows[0] as { actor: string; entity_type: string; changes: Record<string, { from: unknown; to: unknown }> };
  assert.equal(row.entity_type, "medios_de_pago");
  assert.deepEqual(row.changes.alias, { from: "", to: "mi.alias" });

  assert.equal(enviados.length, 1);
  assert.equal(enviados[0].to, "consultas@cordobadigital.net");
  assert.match(enviados[0].text, /mi\.alias/);
});

test("guardar lo mismo otra vez no registra ni avisa de nuevo", async () => {
  const owner = await cookie("duenio@example.com");
  await guardar(put(cuenta, owner));
  enviados.length = 0;
  assert.equal((await guardar(put(cuenta, owner))).status, 200);
  assert.equal(enviados.length, 0);
  assert.equal((await db.execute(sql`select 1 from admin_audit`)).rows.length, 1);
});

test("un admin que no es dueño no puede cambiar la cuenta", async () => {
  await addAdminAccess("empleado@example.com", "duenio@example.com");
  const res = await guardar(put({ ...cuenta, alias: "otra.cuenta" }, await cookie("empleado@example.com")));
  assert.equal(res.status, 403);
  assert.equal((await getTransferAccount())?.alias, "cuenta.vercel");
  assert.equal(enviados.length, 0);
});

test("sin sesión no se puede leer ni cambiar", async () => {
  assert.equal((await guardar(put(cuenta, ""))).status, 401);
  assert.equal((await leer(new Request(`${BASE}/api/admin/payment-methods`))).status, 401);
});

test("un CVU con un dígito mal se rechaza y no cambia nada", async () => {
  const res = await guardar(put({ ...cuenta, number: "0000003100000123456785" }, await cookie("duenio@example.com")));
  assert.equal(res.status, 400);
  assert.equal((await getTransferAccount())?.alias, "cuenta.vercel");
});
