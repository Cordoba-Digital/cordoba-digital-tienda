/**
 * Errores del servidor: se agrupan por huella, avisan por email una sola vez
 * (aunque lleguen juntos), vuelven a avisar si reaparecen después de marcarlos
 * resueltos, y solo un admin los ve y los marca resueltos.
 *
 * Uso: npm run test:api (necesita Postgres local migrado en DATABASE_URL)
 */
import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";

import { sql } from "drizzle-orm";

process.env.ADMIN_PASSWORD = "clave-de-prueba";
process.env.ADMIN_EMAILS = "duenio@example.com";

const { db, pool, resetDb, schema } = await import("./db.mts");
const { GET: listar, PATCH: resolver } = await import("../../src/app/api/admin/errors/route");
const { countOpenErrors, recordServerError } = await import("../../src/lib/error-log");
const { createAdminSessionValue } = await import("../../src/lib/admin-auth");
const { captureMailForTests } = await import("../../src/lib/mailer");

const BASE = "http://localhost:3000";
const enviados = captureMailForTests();

async function sesion(): Promise<string> {
  return `admin_session=${encodeURIComponent((await createAdminSessionValue("duenio@example.com"))!)}`;
}

async function marcar(fingerprint: unknown, cookie?: string): Promise<Response> {
  return resolver(
    new Request(`${BASE}/api/admin/errors`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: cookie ?? (await sesion()), origin: BASE },
      body: JSON.stringify({ fingerprint }),
    }),
  );
}

async function filas() {
  return db.select().from(schema.errorEvents);
}

const falla = (n: number) => ({
  message: `Pedido ${n} no encontrado para ana@example.com`,
  stack: "Error: x\n    at handler (route.ts:10:5)",
  route: "/api/admin/orders/[code]",
  path: `/api/admin/orders/CD-${n}?token=secreto`,
  method: "GET",
});

beforeEach(async () => {
  await resetDb();
  await db.execute(sql`truncate table admin_audit`).catch(() => undefined);
  enviados.length = 0;
});
after(() => pool.end());

test("el mismo error repetido es una fila con su cuenta, sin datos del cliente ni query string", async () => {
  await recordServerError(falla(1));
  await recordServerError(falla(2));
  await recordServerError(falla(3));
  const rows = await filas();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].count, 3);
  assert.equal(rows[0].message, "Pedido 3 no encontrado para [email]");
  assert.equal(rows[0].path, "/api/admin/orders/CD-3");
  assert.equal(await countOpenErrors(), 1);
});

test("diez errores iguales a la vez mandan un solo email", async () => {
  await Promise.all(Array.from({ length: 10 }, (_, i) => recordServerError(falla(i))));
  assert.equal((await filas())[0].count, 10);
  assert.equal(enviados.length, 1);
  assert.equal(enviados[0].to, "duenio@example.com");
  assert.match(enviados[0].subject, /^Error en la tienda: Pedido \d no encontrado/);
  assert.match(enviados[0].text, /\/admin\/errores$/m);
  assert.doesNotMatch(enviados[0].text, /ana@example\.com|secreto/);
});

test("si sigue pasando no vuelve a avisar antes de 6 horas, y después sí", async () => {
  await recordServerError(falla(1));
  await recordServerError(falla(2));
  assert.equal(enviados.length, 1);
  await db.execute(sql`update error_events set last_alerted_at = now() - interval '7 hours'`);
  await recordServerError(falla(3));
  assert.equal(enviados.length, 2);
});

test("muchos errores distintos en una hora mandan como mucho 10 emails, pero quedan todos en el panel", async () => {
  const palabras = "alfa beta gama delta épsilon zeta eta theta iota kappa lambda mu".split(" ");
  for (const p of palabras) await recordServerError({ ...falla(1), message: `invalid input syntax: "${p}"` });
  assert.equal((await filas()).length, 12);
  assert.equal(enviados.length, 10);
});

test("con la tabla llena no guarda tipos nuevos, pero sigue contando los que ya están", async () => {
  await recordServerError(falla(1));
  await db.execute(
    sql`insert into error_events (fingerprint, message) select lpad(to_hex(g), 24, '0'), 'relleno ' || g from generate_series(1, 999) g`,
  );
  await recordServerError({ ...falla(1), message: "uno nuevo" });
  assert.equal((await filas()).length, 1000);
  await recordServerError(falla(2));
  const [row] = await db.select().from(schema.errorEvents).where(sql`${schema.errorEvents.route} <> ''`);
  assert.equal(row.count, 2);

  // Con resueltos, los borra para hacer lugar.
  await db.execute(sql`update error_events set resolved_at = now() where message like 'relleno%'`);
  await recordServerError({ ...falla(1), message: "uno nuevo" });
  assert.deepEqual((await filas()).map((f) => f.message).sort(), ["Pedido 2 no encontrado para [email]", "uno nuevo"]);
});

test("marcarlo resuelto lo saca de la cuenta, y si reaparece se reabre y avisa enseguida", async () => {
  await recordServerError(falla(1));
  const [row] = await filas();
  const res = await marcar(row.fingerprint);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, resolved: 1 });
  assert.ok((await filas())[0].resolvedAt);
  assert.equal(await countOpenErrors(), 0);

  await recordServerError(falla(2));
  assert.equal((await filas())[0].resolvedAt, null);
  assert.equal(enviados.length, 2);
});

test("\"todos\" marca resueltos los abiertos y queda en Actividad", async () => {
  await recordServerError(falla(1));
  await recordServerError({ ...falla(1), route: "/api/checkout" });
  const res = await marcar("todos");
  assert.deepEqual(await res.json(), { ok: true, resolved: 2 });
  assert.equal(await countOpenErrors(), 0);
  const [audit] = await db.select().from(schema.adminAudit);
  assert.equal(audit.entityType, "error");
  assert.equal(audit.action, "resolver");
  assert.equal(audit.actor, "duenio@example.com");
  assert.match(audit.summary, /resueltos 2 errores/);
});

test("sin sesión no se ven ni se marcan; una huella inventada es 400", async () => {
  await recordServerError(falla(1));
  assert.equal((await listar(new Request(`${BASE}/api/admin/errors`))).status, 401);
  assert.equal((await marcar("todos", "admin_session=falsa")).status, 401);
  assert.equal(await countOpenErrors(), 1);
  assert.equal((await marcar("'; drop table error_events; --")).status, 400);
  assert.equal((await marcar(123)).status, 400);

  const res = await listar(new Request(`${BASE}/api/admin/errors`, { headers: { cookie: await sesion() } }));
  assert.equal(res.status, 200);
  const { errors } = (await res.json()) as { errors: { count: number }[] };
  assert.equal(errors.length, 1);
});
