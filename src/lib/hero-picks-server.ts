import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { orderItems, orders, products, storeSettings } from "@/db/schema";
import { ensureSettingsSchema, isAutomationOn } from "@/lib/automations";
import { PAID_STATUSES } from "@/lib/payment-rules";
import { getBestSellers, getDealProducts, getFeaturedProducts } from "@/lib/queries";
import {
  HERO_SALES_DAYS,
  HERO_SLIDES,
  parseHeroSettings,
  pickHeroSlides,
  type HeroPicks,
  type HeroSettings,
  type HeroSlideId,
} from "@/lib/hero-picks";

export const HERO_SETTINGS_KEY = "portada.carrusel";

type ProductRow = typeof products.$inferSelect;
export type HeroProduct = ProductRow & { recentUnits: number };

export async function getHeroSettings(): Promise<HeroSettings> {
  try {
    const [row] = await db.select().from(storeSettings).where(eq(storeSettings.key, HERO_SETTINGS_KEY)).limit(1);
    return parseHeroSettings(row?.value);
  } catch (error) {
    console.warn("[portada] sin productos fijados, elijo solo:", error instanceof Error ? error.message : error);
    return parseHeroSettings(null);
  }
}

/** Guarda la configuración ya validada con `parseHeroSettings`. */
export async function saveHeroSettings(settings: HeroSettings, actor: string): Promise<void> {
  await ensureSettingsSchema();
  const now = new Date();
  await db
    .insert(storeSettings)
    .values({ key: HERO_SETTINGS_KEY, value: settings, updatedBy: actor, updatedAt: now })
    .onConflictDoUpdate({ target: storeSettings.key, set: { value: settings, updatedBy: actor, updatedAt: now } });
}

/**
 * Productos que pueden ir al carrusel, con sus ventas recientes. No hace falta
 * leer todo el catálogo: alcanza con los más vendidos, las mejores ofertas, los
 * destacados, los de envío gratis y los fijados a mano.
 */
async function loadCandidates(extraSlugs: string[]): Promise<HeroProduct[]> {
  const since = new Date(Date.now() - HERO_SALES_DAYS * 24 * 60 * 60 * 1000);
  const sales = db
    .select({
      slug: orderItems.productSlug,
      units: sql<number>`sum(${orderItems.quantity})::int`.as("units"),
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(inArray(orders.status, PAID_STATUSES), gte(orders.createdAt, since)))
    .groupBy(orderItems.productSlug)
    .as("ventas");
  const recentUnits = sql<number>`coalesce(${sales.units}, 0)::int`;
  const base = () =>
    db
      .select({ product: products, recentUnits })
      .from(products)
      .leftJoin(sales, eq(sales.slug, products.slug));
  const available = and(gte(products.stock, 1), sql`${products.price} > 0`, sql`jsonb_array_length(${products.images}) > 0`);
  const discount = sql`(coalesce(${products.compareAtPrice}, ${products.price}) - ${products.price})::float / greatest(coalesce(${products.compareAtPrice}, ${products.price}), 1)`;

  const groups = await Promise.all([
    base()
      .where(available)
      .orderBy(desc(recentUnits), desc(products.soldCount), desc(products.reviewCount), desc(products.createdAt))
      .limit(40),
    base().where(and(available, sql`${products.compareAtPrice} > ${products.price}`)).orderBy(desc(discount)).limit(15),
    base().where(and(available, eq(products.featured, true))).orderBy(desc(recentUnits), desc(products.createdAt)).limit(15),
    base().where(and(available, eq(products.freeShipping, true))).orderBy(desc(recentUnits), desc(products.createdAt)).limit(15),
    extraSlugs.length ? base().where(inArray(products.slug, extraSlugs)) : Promise.resolve([]),
  ]);
  const bySlug = new Map<string, HeroProduct>();
  for (const row of groups.flat()) {
    if (!bySlug.has(row.product.slug)) bySlug.set(row.product.slug, { ...row.product, recentUnits: Number(row.recentUnits) || 0 });
  }
  return [...bySlug.values()];
}

/**
 * Los cinco productos del carrusel. `fallback` es la elección de siempre
 * (los más nuevos, la mejor oferta, el más reseñado), que se usa con la
 * automatización apagada.
 */
export type HeroFallback = Partial<Record<HeroSlideId, ProductRow | null>>;

/** La elección de antes de la automatización, con los mismos queries que usa la home. */
export async function legacyHeroFallback(): Promise<HeroFallback> {
  const [featured, deals, best] = await Promise.all([getFeaturedProducts(3), getDealProducts(1), getBestSellers(1)]);
  return { inicio: featured[0], ofertas: deals[0], vendidos: best[0], envios: featured[1], pagos: featured[2] };
}

export async function getHeroPicks(fallback?: HeroFallback): Promise<HeroPicks<HeroProduct>> {
  const [settings, auto] = await Promise.all([getHeroSettings(), isAutomationOn("portadaAutomatica").catch(() => true)]);
  if (!fallback) fallback = auto ? {} : await legacyHeroFallback();
  const fallbackSlugs = Object.values(fallback).flatMap((p) => (p ? [p.slug] : []));
  const pool = await loadCandidates([...Object.values(settings.pinned), ...fallbackSlugs]);
  const bySlug = new Map(pool.map((p) => [p.slug, p]));
  const fallbackPicks = Object.fromEntries(
    Object.entries(fallback).map(([id, p]) => [id, p ? (bySlug.get(p.slug) ?? null) : null]),
  ) as Partial<Record<HeroSlideId, HeroProduct | null>>;
  return pickHeroSlides(pool, settings, { auto, fallback: fallbackPicks });
}

export type HeroAdminProduct = { slug: string; name: string; image: string; price: number; stock: number };

export type HeroAdminState = {
  auto: boolean;
  settings: HeroSettings;
  slides: {
    id: HeroSlideId;
    label: string;
    rule: string;
    pick: (HeroAdminProduct & { source: "fijado" | "automatico" }) | null;
    /** Fijado a mano pero sin stock, sin foto o sacado: el slide eligió otro. */
    pinnedUnavailable: HeroAdminProduct | null;
  }[];
  excluded: HeroAdminProduct[];
};

function adminView(p: ProductRow): HeroAdminProduct {
  return { slug: p.slug, name: p.name, image: p.images[0] ?? "", price: p.price, stock: p.stock };
}

/** Lo que muestra el panel: qué va hoy en cada slide y qué fijó o sacó César. */
export async function getHeroAdminState(): Promise<HeroAdminState> {
  const [settings, auto, picks] = await Promise.all([getHeroSettings(), isAutomationOn("portadaAutomatica"), getHeroPicks()]);
  const named = [...new Set([...Object.values(settings.pinned), ...settings.excluded])];
  const rows = named.length ? await db.select().from(products).where(inArray(products.slug, named)) : [];
  const bySlug = new Map(rows.map((p) => [p.slug, p]));
  return {
    auto,
    settings,
    slides: HERO_SLIDES.map((slide) => {
      const pick = picks[slide.id];
      const pinnedSlug = settings.pinned[slide.id];
      const pinned = pinnedSlug ? bySlug.get(pinnedSlug) : undefined;
      const pinnedUnavailable =
        pinnedSlug && pick?.product.slug !== pinnedSlug
          ? pinned
            ? adminView(pinned)
            : { slug: pinnedSlug, name: pinnedSlug, image: "", price: 0, stock: 0 }
          : null;
      return {
        id: slide.id,
        label: slide.label,
        rule: slide.rule,
        pick: pick ? { ...adminView(pick.product), source: pick.source } : null,
        pinnedUnavailable,
      };
    }),
    excluded: settings.excluded.flatMap((slug) => {
      const p = bySlug.get(slug);
      return p ? [adminView(p)] : [{ slug, name: slug, image: "", price: 0, stock: 0 }];
    }),
  };
}
