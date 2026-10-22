/**
 * Ofertas programadas: el precio de oferta entra a la hora exacta (nunca
 * antes), el precio que tenía queda como "antes", y al terminar vuelve solo.
 * El checkout cobra el precio de esa hora aunque nadie haya pasado por la
 * tienda.
 *
 * Uso: npm run test:api (necesita Postgres local migrado en DATABASE_URL)
 */
import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";

import { eq } from "drizzle-orm";

import { comprador, db, domicilio, pool, post, resetDb, schema, seedProduct } from "./db.mts";

delete process.env.MP_ACCESS_TOKEN;
const { applyDuePriceSchedules, cancelPriceSchedule, createPriceSchedule, nextPriceChangeAt, parseStoreDateTime } = await import(
  "../../src/lib/price-schedules"
);
const checkout = await import("../../src/app/api/checkout/route");
const tick = await import("../../src/app/api/ofertas/tick/route");

beforeEach(resetDb);
after(() => pool.end());

const INICIO = "2026-12-01T00:00";
const FIN = "2026-12-03T23:59";
const inicio = parseStoreDateTime(INICIO)!;
const fin = parseStoreDateTime(FIN)!;
const antes = new Date("2026-11-20T12:00:00Z");

async function producto(slug: string) {
  const [row] = await db
    .select({ price: schema.products.price, compareAtPrice: schema.products.compareAtPrice })
    .from(schema.products)
    .where(eq(schema.products.slug, slug));
  return row;
}

async function programar(slug: string, offerPrice: number, startsAt = INICIO, endsAt = FIN) {
  const result = await createPriceSchedule({ slug, offerPrice, startsAt, endsAt }, "test", antes);
  assert.ok(result.ok, result.ok ? "" : result.error);
  return result.schedule;
}

test("la hora se toma como hora de Córdoba (UTC-3)", () => {
  assert.equal(inicio.toISOString(), "2026-12-01T03:00:00.000Z");
  assert.equal(parseStoreDateTime("2026-12-01"), null);
  assert.equal(parseStoreDateTime(123), null);
});

test("empieza a la hora exacta, nunca antes, y al terminar vuelve el precio de antes", async () => {
  await seedProduct("tele", 1_000_000, 5);
  await db.update(schema.products).set({ compareAtPrice: 1_200_000 }).where(eq(schema.products.slug, "tele"));
  await programar("tele", 800_000);

  // Un milisegundo antes: nada.
  assert.deepEqual(await applyDuePriceSchedules(new Date(inicio.getTime() - 1)), { changed: [] });
  assert.deepEqual(await producto("tele"), { price: 1_000_000, compareAtPrice: 1_200_000 });

  // En punto: oferta, con el precio que tenía como "antes".
  assert.deepEqual(await applyDuePriceSchedules(inicio), { changed: ["tele"] });
  assert.deepEqual(await producto("tele"), { price: 800_000, compareAtPrice: 1_000_000 });
  // Llamarlo de nuevo no cambia nada.
  assert.deepEqual(await applyDuePriceSchedules(new Date(inicio.getTime() + 60_000)), { changed: [] });

  assert.deepEqual(await applyDuePriceSchedules(fin), { changed: ["tele"] });
  assert.deepEqual(await producto("tele"), { price: 1_000_000, compareAtPrice: 1_200_000 });
  const [s] = await db.select().from(schema.priceSchedules);
  assert.equal(s.status, "terminada");
});

test("si cambian el precio a mano durante la oferta, al terminar se respeta", async () => {
  await seedProduct("celu", 500_000, 5);
  await programar("celu", 400_000);
  await applyDuePriceSchedules(inicio);
  await db.update(schema.products).set({ price: 380_000 }).where(eq(schema.products.slug, "celu"));

  assert.deepEqual(await applyDuePriceSchedules(fin), { changed: [] });
  assert.equal((await producto("celu")).price, 380_000);
  const [s] = await db.select().from(schema.priceSchedules);
  assert.match(s.note, /a mano/);
});

test("una oferta que empieza cuando termina otra toma como antes el precio normal", async () => {
  await seedProduct("note", 900_000, 5);
  await programar("note", 800_000, "2026-12-01T00:00", "2026-12-02T00:00");
  await programar("note", 700_000, "2026-12-02T00:00", "2026-12-03T00:00");
  await applyDuePriceSchedules(inicio);
  await applyDuePriceSchedules(parseStoreDateTime("2026-12-02T00:00")!);
  assert.deepEqual(await producto("note"), { price: 700_000, compareAtPrice: 900_000 });
  await applyDuePriceSchedules(parseStoreDateTime("2026-12-03T00:00")!);
  assert.deepEqual(await producto("note"), { price: 900_000, compareAtPrice: null });
});

test("rechaza ofertas que no bajan el precio, horarios al revés y superpuestas", async () => {
  await seedProduct("tele", 1_000_000, 5);
  const crear = (body: Record<string, unknown>) => createPriceSchedule({ slug: "tele", offerPrice: 900_000, startsAt: INICIO, endsAt: FIN, ...body }, "test", antes);
  assert.equal((await crear({ offerPrice: 1_000_000 })).ok, false);
  assert.equal((await crear({ offerPrice: 899_999.5 })).ok, false);
  assert.equal((await crear({ endsAt: INICIO })).ok, false);
  assert.equal((await crear({ startsAt: "2026-11-01T00:00", endsAt: "2026-11-02T00:00" })).ok, false, "el fin ya pasó");
  assert.equal((await crear({ slug: "no-existe" })).ok, false);
  assert.equal((await crear({})).ok, true);
  assert.equal((await crear({ startsAt: "2026-12-03T00:00", endsAt: "2026-12-05T00:00" })).ok, false, "se superpone");
  assert.equal((await crear({ startsAt: FIN, endsAt: "2026-12-05T00:00" })).ok, true, "pegada a la anterior sí");
});

test("cancelar una programada no toca el precio; terminar una activa lo devuelve", async () => {
  await seedProduct("a", 100_000, 5);
  await seedProduct("b", 100_000, 5);
  const a = await programar("a", 90_000);
  const b = await programar("b", 90_000);
  assert.deepEqual(await cancelPriceSchedule(a.id, antes), { slug: "a", restored: false });
  await applyDuePriceSchedules(inicio);
  assert.equal((await producto("a")).price, 100_000, "la cancelada no empieza");
  assert.equal((await producto("b")).price, 90_000);
  assert.deepEqual(await cancelPriceSchedule(b.id, inicio), { slug: "b", restored: true });
  assert.deepEqual(await producto("b"), { price: 100_000, compareAtPrice: null });
});

test("el checkout cobra el precio de oferta en cuanto empieza, sin que nadie la haya aplicado", async () => {
  await seedProduct("celu", 500_000, 10);
  const ahora = Date.now();
  await db.insert(schema.priceSchedules).values({
    productSlug: "celu",
    offerPrice: 450_000,
    startsAt: new Date(ahora - 1_000),
    endsAt: new Date(ahora + 3_600_000),
  });
  const res = await checkout.POST(
    post("/api/checkout", { customer: comprador, delivery: domicilio, payment: { method: "transferencia" }, items: [{ slug: "celu", quantity: 1 }] }),
  );
  const body = (await res.json()) as { code: string };
  assert.equal(res.status, 200, JSON.stringify(body));
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.code, body.code));
  assert.equal(order.subtotal, 450_000);
});

test("el tick aplica lo vencido y dice cuándo es el próximo cambio", async () => {
  await seedProduct("celu", 500_000, 10);
  const ahora = Date.now();
  const termina = new Date(ahora + 3_600_000);
  await db.insert(schema.priceSchedules).values({ productSlug: "celu", offerPrice: 450_000, startsAt: new Date(ahora - 1_000), endsAt: termina });
  const res = await tick.POST();
  const body = (await res.json()) as { changed: number; next: string };
  assert.equal(body.changed, 1);
  assert.equal(body.next, termina.toISOString());
  assert.equal((await nextPriceChangeAt())?.toISOString(), termina.toISOString());
});
