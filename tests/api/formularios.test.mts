/**
 * Formularios públicos (arrepentimiento y newsletter): guardan lo que llega
 * recortado a un largo razonable y frenan a quien manda demasiados.
 *
 * Uso: npm run test:api (necesita Postgres local migrado en DATABASE_URL)
 */
import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";

import { db, pool, post, resetDb, schema } from "./db.mts";

delete process.env.SMTP_HOST;
const arrepentimiento = await import("../../src/app/api/arrepentimiento/route");
const newsletter = await import("../../src/app/api/newsletter/route");
const { FORM_LIMIT, NEWSLETTER_LIMIT } = await import("../../src/lib/rate-limit");

const solicitud = {
  nombre: "Ana Pérez",
  email: "ana@example.com",
  telefono: "351 555-1234",
  fechaCompra: "2026-10-01",
  producto: "Notebook",
};

beforeEach(resetDb);
after(() => pool.end());

test("arrepentimiento recorta los textos largos y limita los envíos por IP", async () => {
  const ip = { "x-real-ip": "200.1.1.1" };
  const res = await arrepentimiento.POST(post("/api/arrepentimiento", { ...solicitud, comentarios: "x".repeat(50_000) }, ip));
  assert.equal(res.status, 200);
  const [guardada] = await db.select().from(schema.arrepentimientoRequests);
  assert.equal(guardada.comentarios.length, 2000);

  for (let i = 1; i < FORM_LIMIT.max; i += 1) {
    assert.equal((await arrepentimiento.POST(post("/api/arrepentimiento", solicitud, ip))).status, 200);
  }
  assert.equal((await arrepentimiento.POST(post("/api/arrepentimiento", solicitud, ip))).status, 429);
  assert.equal((await db.select().from(schema.arrepentimientoRequests)).length, FORM_LIMIT.max);
});

test("arrepentimiento con campos que no son texto responde 400, no 500", async () => {
  const res = await arrepentimiento.POST(post("/api/arrepentimiento", { nombre: 123, email: ["a@b.co"] }));
  assert.equal(res.status, 400);
});

test("newsletter rechaza emails absurdos y limita los envíos por IP", async () => {
  const ip = { "x-real-ip": "200.2.2.2" };
  assert.equal((await newsletter.POST(post("/api/newsletter", { email: `${"a".repeat(300)}@example.com` }, ip))).status, 400);
  assert.equal((await newsletter.POST(post("/api/newsletter", { email: { $ne: 1 } }, ip))).status, 400);
  for (let i = 0; i < NEWSLETTER_LIMIT.max; i += 1) {
    assert.equal((await newsletter.POST(post("/api/newsletter", { email: `persona${i}@example.com` }, ip))).status, 200);
  }
  assert.equal((await newsletter.POST(post("/api/newsletter", { email: "otra@example.com" }, ip))).status, 429);
  assert.equal((await db.select().from(schema.subscribers)).length, NEWSLETTER_LIMIT.max);
});
