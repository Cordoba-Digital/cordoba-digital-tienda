/**
 * Carrusel de la portada: cada slide elige el producto que encaja con lo que
 * dice, sin repetir, solo con stock y foto, y lo fijado o sacado a mano gana.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { parseHeroSettings, pickHeroSlides, type HeroCandidate } from "../../src/lib/hero-picks";

let n = 0;
function producto(slug: string, extra: Partial<HeroCandidate> = {}): HeroCandidate {
  n += 1;
  return {
    slug,
    price: 100_000,
    compareAtPrice: null,
    stock: 3,
    images: ["/foto.jpg"],
    featured: false,
    freeShipping: false,
    soldCount: 0,
    reviewCount: 0,
    createdAt: new Date(2026, 0, n),
    recentUnits: 0,
    ...extra,
  };
}

const sinFijar = parseHeroSettings(null);
const slugs = (picks: ReturnType<typeof pickHeroSlides>) =>
  Object.fromEntries(Object.entries(picks).map(([id, pick]) => [id, pick?.product.slug ?? null]));

test("cada slide toma el producto que mejor le va y ninguno se repite", () => {
  const pool = [
    producto("nuevo"),
    producto("vendido", { recentUnits: 9 }),
    producto("segundo", { recentUnits: 4 }),
    producto("oferta", { compareAtPrice: 200_000, recentUnits: 1 }),
    producto("ofertita", { compareAtPrice: 110_000, recentUnits: 6 }),
    producto("destacado", { featured: true, recentUnits: 2 }),
    producto("gratis", { freeShipping: true }),
  ];
  assert.deepEqual(slugs(pickHeroSlides(pool, sinFijar, { auto: true })), {
    inicio: "destacado",
    ofertas: "oferta",
    vendidos: "vendido",
    envios: "gratis",
    pagos: "ofertita",
  });
});

test("sin stock, sin precio o sin foto no entra", () => {
  const pool = [
    producto("agotado", { stock: 0, recentUnits: 50 }),
    producto("sin-foto", { images: [], recentUnits: 40 }),
    producto("sin-precio", { price: 0, recentUnits: 30 }),
    producto("ok", { recentUnits: 1 }),
  ];
  const picks = pickHeroSlides(pool, sinFijar, { auto: true });
  assert.deepEqual(
    Object.values(picks).flatMap((p) => (p ? [p.product.slug] : [])),
    ["ok"],
  );
});

test("lo fijado gana, y si se queda sin stock el slide elige solo", () => {
  const pool = [producto("vendido", { recentUnits: 9 }), producto("elegido"), producto("agotado", { stock: 0 })];
  const fijado = pickHeroSlides(pool, parseHeroSettings({ pinned: { vendidos: "elegido" } }), { auto: true });
  assert.equal(fijado.vendidos?.product.slug, "elegido");
  assert.equal(fijado.vendidos?.source, "fijado");
  assert.notEqual(fijado.inicio?.product.slug, "elegido");

  const sinStock = pickHeroSlides(pool, parseHeroSettings({ pinned: { vendidos: "agotado" } }), { auto: true });
  assert.equal(sinStock.vendidos?.product.slug, "vendido");
  assert.equal(sinStock.vendidos?.source, "automatico");
});

test("lo sacado no aparece en ningún slide", () => {
  const pool = [producto("vendido", { recentUnits: 9 }), producto("otro")];
  const picks = pickHeroSlides(pool, parseHeroSettings({ excluded: ["vendido"] }), { auto: true });
  assert.ok(Object.values(picks).every((p) => p?.product.slug !== "vendido"));
});

test("apagada, usa la elección de antes pero respeta lo fijado y lo sacado", () => {
  const nuevo = producto("nuevo");
  const vendido = producto("vendido", { recentUnits: 9 });
  const pool = [nuevo, vendido, producto("elegido")];
  const picks = pickHeroSlides(pool, parseHeroSettings({ pinned: { pagos: "elegido" }, excluded: ["vendido"] }), {
    auto: false,
    fallback: { inicio: nuevo, vendidos: vendido },
  });
  assert.equal(picks.inicio?.product.slug, "nuevo");
  assert.equal(picks.pagos?.product.slug, "elegido");
  assert.ok(Object.values(picks).every((p) => p?.product.slug !== "vendido"));
});

test("la configuración guardada se limpia: slides desconocidos, repetidos y basura afuera", () => {
  assert.deepEqual(parseHeroSettings({ pinned: { inicio: " a ", raro: "b", pagos: 3 }, excluded: ["x", "x", "", 5, "y"] }), {
    pinned: { inicio: "a" },
    excluded: ["x", "y"],
  });
  assert.deepEqual(parseHeroSettings("cualquier cosa"), { pinned: {}, excluded: [] });
});
