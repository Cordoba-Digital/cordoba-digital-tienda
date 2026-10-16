/**
 * Qué producto muestra cada slide del carrusel de la portada.
 *
 * Con la automatización "Elegir los productos de la portada" prendida, cada
 * slide toma el producto que mejor encaja con lo que dice: la oferta con más
 * descuento, lo más vendido de los últimos días, y en el resto los que más se
 * venden (primero los marcados como destacados en "Principal" y los de envío
 * gratis en "Envíos"). Solo entran productos con stock, precio y foto, y nunca
 * se repite uno entre slides.
 *
 * Lo que César fija a mano en Automatizaciones gana siempre (si el producto
 * fijado se queda sin stock, el slide vuelve a elegir solo), y lo que saca no
 * aparece en ningún slide.
 *
 * Este archivo lo usa también el navegador (el panel): solo tiene la lógica,
 * sin base. La lectura y el guardado viven en `hero-picks-server.ts`.
 */

export const HERO_SLIDES = [
  { id: "inicio", label: "Principal", rule: "El más vendido entre los destacados (o entre todos, si no hay destacados)." },
  { id: "ofertas", label: "Ofertas", rule: "La oferta con más descuento." },
  { id: "vendidos", label: "Más vendidos", rule: "El que más unidades vendió en los últimos 30 días." },
  { id: "envios", label: "Envíos", rule: "El más vendido con envío gratis (o el siguiente más vendido)." },
  { id: "pagos", label: "Pagos", rule: "El siguiente más vendido." },
] as const;

export type HeroSlideId = (typeof HERO_SLIDES)[number]["id"];

export const HERO_SLIDE_IDS = HERO_SLIDES.map((slide) => slide.id) as HeroSlideId[];

/** Días de ventas que cuentan para "más vendido". */
export const HERO_SALES_DAYS = 30;

/** Tope de productos sacados a mano, para que la lista no crezca sin control. */
export const HERO_MAX_EXCLUDED = 60;

export type HeroSettings = {
  /** Producto fijado a mano por slide (slug). */
  pinned: Partial<Record<HeroSlideId, string>>;
  /** Productos que no aparecen en el carrusel (slugs). */
  excluded: string[];
};

export type HeroCandidate = {
  slug: string;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  images: string[];
  featured: boolean;
  freeShipping: boolean;
  soldCount: number;
  reviewCount: number;
  createdAt: Date;
  /** Unidades vendidas (pedidos pagos) en los últimos `HERO_SALES_DAYS` días. */
  recentUnits: number;
};

export type HeroPickSource = "fijado" | "automatico";

export type HeroPick<T> = { product: T; source: HeroPickSource };

export type HeroPicks<T> = Record<HeroSlideId, HeroPick<T> | null>;

export function isHeroSlideId(value: unknown): value is HeroSlideId {
  return typeof value === "string" && (HERO_SLIDE_IDS as string[]).includes(value);
}

function cleanSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const slug = value.trim();
  return slug && slug.length <= 300 ? slug : null;
}

/** Convierte lo guardado (o lo que manda el panel) en una configuración válida. */
export function parseHeroSettings(json: unknown): HeroSettings {
  const result: HeroSettings = { pinned: {}, excluded: [] };
  if (!json || typeof json !== "object") return result;
  const raw = json as { pinned?: unknown; excluded?: unknown };
  if (raw.pinned && typeof raw.pinned === "object") {
    for (const [id, value] of Object.entries(raw.pinned)) {
      const slug = cleanSlug(value);
      if (isHeroSlideId(id) && slug) result.pinned[id] = slug;
    }
  }
  if (Array.isArray(raw.excluded)) {
    const seen = new Set<string>();
    for (const value of raw.excluded) {
      const slug = cleanSlug(value);
      if (slug && !seen.has(slug)) seen.add(slug);
    }
    result.excluded = [...seen].slice(0, HERO_MAX_EXCLUDED);
  }
  return result;
}

/** Con stock, precio y foto: lo mínimo para que la tarjeta del carrusel se vea bien y se pueda comprar. */
export function isHeroEligible(product: HeroCandidate): boolean {
  return product.stock >= 1 && product.price > 0 && product.images.some((image) => Boolean(image));
}

function discount(product: HeroCandidate): number {
  const before = product.compareAtPrice ?? 0;
  return before > product.price ? (before - product.price) / before : 0;
}

/** Más vendido primero: ventas recientes, ventas totales, reseñas y, a la par, lo más nuevo. */
export function comparePopularity(a: HeroCandidate, b: HeroCandidate): number {
  return (
    b.recentUnits - a.recentUnits ||
    b.soldCount - a.soldCount ||
    b.reviewCount - a.reviewCount ||
    b.createdAt.getTime() - a.createdAt.getTime() ||
    a.slug.localeCompare(b.slug)
  );
}

/**
 * Arma los cinco slides. `fallback` es lo que mostraba la portada antes de la
 * automatización (se usa con el interruptor apagado); los fijados y sacados a
 * mano valen igual con el interruptor prendido o apagado.
 */
export function pickHeroSlides<T extends HeroCandidate>(
  pool: T[],
  settings: HeroSettings,
  options: { auto: boolean; fallback?: Partial<Record<HeroSlideId, T | null>> },
): HeroPicks<T> {
  const excluded = new Set(settings.excluded);
  const bySlug = new Map<string, T>();
  for (const product of pool) {
    if (!excluded.has(product.slug) && isHeroEligible(product) && !bySlug.has(product.slug)) bySlug.set(product.slug, product);
  }
  const ranked = [...bySlug.values()].sort(comparePopularity);
  const used = new Set<string>();
  const picks = Object.fromEntries(HERO_SLIDE_IDS.map((id) => [id, null])) as HeroPicks<T>;

  const take = (id: HeroSlideId, product: T | undefined, source: HeroPickSource): boolean => {
    if (!product || used.has(product.slug)) return false;
    used.add(product.slug);
    picks[id] = { product, source };
    return true;
  };
  const best = (filter: (product: T) => boolean = () => true) => ranked.find((p) => !used.has(p.slug) && filter(p));

  // 1. Lo fijado a mano, si sigue con stock y no está sacado.
  for (const id of HERO_SLIDE_IDS) {
    const slug = settings.pinned[id];
    if (slug) take(id, bySlug.get(slug), "fijado");
  }

  // 2. Cada slide con su regla. Solo entra un producto que la cumpla de verdad
  //    (una oferta en "Ofertas", algo vendido en "Más vendidos"...).
  const order: HeroSlideId[] = ["ofertas", "vendidos", "inicio", "envios", "pagos"];
  for (const id of order) {
    if (picks[id]) continue;
    if (!options.auto) {
      const before = options.fallback?.[id];
      take(id, before ? bySlug.get(before.slug) : undefined, "automatico");
      continue;
    }
    switch (id) {
      case "ofertas": {
        const deal = ranked
          .filter((p) => !used.has(p.slug) && discount(p) > 0)
          .sort((a, b) => discount(b) - discount(a) || comparePopularity(a, b))[0];
        take(id, deal, "automatico");
        break;
      }
      case "vendidos":
        take(id, best((p) => p.recentUnits > 0 || p.soldCount > 0), "automatico");
        break;
      case "inicio":
        take(id, best((p) => p.featured), "automatico");
        break;
      case "envios":
        take(id, best((p) => p.freeShipping), "automatico");
        break;
      default:
        take(id, best(), "automatico");
    }
  }

  // 3. Los que quedaron vacíos, con los más vendidos que sobren. "Ofertas" va
  //    última para que no se lleve el mejor producto si no hay ninguna oferta.
  for (const id of ["inicio", "vendidos", "envios", "pagos", "ofertas"] as const) {
    if (!picks[id]) take(id, best(), "automatico");
  }
  return picks;
}
