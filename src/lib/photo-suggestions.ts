import { eq, inArray, sql } from "drizzle-orm";

import suggestionsFile from "@/data/fotos-sugeridas.json";
import { db } from "@/db";
import { products } from "@/db/schema";
import { clearPhotoFlagIfMainChanged } from "@/lib/photo-checks";
import { importRemoteImage, type SaveImageResult } from "@/lib/product-images";

/**
 * Fotos sugeridas para productos con foto chica o sin foto.
 *
 * La lista sale de `src/data/fotos-sugeridas.json`: para cada producto, una
 * foto oficial del fabricante encontrada a mano, hasta 4 vistas más de la
 * misma galería (`extras`) y el link de dónde salió. Nada se carga solo: en el
 * panel (Catálogo → Fotos) se ve la foto actual al lado de la sugerida, y
 * "Usar" descarga la principal y las vistas tildadas, las pasa a WebP y las
 * pone primeras. Lo usado o descartado queda en `photo_suggestion_decisions`
 * y no vuelve a aparecer.
 */

export type PhotoSuggestion = {
  slug: string;
  image: string;
  source: string;
  confidence: "alta" | "media";
  note?: string;
  /** Otras vistas del mismo producto, de la misma galería oficial. */
  extras?: string[];
};

export const MAX_EXTRAS = 4;
const isHttp = (url: unknown): url is string => typeof url === "string" && /^https?:\/\//.test(url);

export const PHOTO_SUGGESTIONS: PhotoSuggestion[] = (suggestionsFile as PhotoSuggestion[])
  .filter((s) => s.slug && isHttp(s.image))
  .map((s) => {
    const extras = [...new Set((s.extras ?? []).filter(isHttp))].filter((u) => u !== s.image).slice(0, MAX_EXTRAS);
    const { extras: _ignored, ...rest } = s;
    return extras.length ? { ...rest, extras } : rest;
  });

let tableReady: Promise<void> | null = null;
function ensureDecisionsTable(): Promise<void> {
  if (!tableReady) {
    tableReady = db
      .execute(sql`create table if not exists photo_suggestion_decisions (
        product_id integer primary key,
        image text not null,
        decision text not null,
        decided_at timestamptz not null default now()
      )`)
      .then(() => undefined)
      .catch((error) => {
        tableReady = null;
        throw error;
      });
  }
  return tableReady;
}

function slugVariants(slug: string): string[] {
  try {
    const decoded = decodeURIComponent(slug);
    return decoded === slug ? [slug] : [slug, decoded];
  } catch {
    return [slug];
  }
}

export type PendingSuggestion = PhotoSuggestion & {
  productId: number;
  productSlug: string;
  name: string;
  currentImage: string;
};

/** Sugerencias que todavía no se usaron ni se descartaron, de productos que siguen en el catálogo. */
export async function listPendingSuggestions(
  suggestions: PhotoSuggestion[] = PHOTO_SUGGESTIONS,
): Promise<PendingSuggestion[]> {
  if (!suggestions.length) return [];
  await ensureDecisionsTable();
  const rows = await db
    .select({ id: products.id, slug: products.slug, name: products.name, images: products.images })
    .from(products)
    .where(inArray(products.slug, suggestions.flatMap((s) => slugVariants(s.slug))));
  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  const decided = await db.execute<{ product_id: number; image: string }>(
    sql`select product_id, image from photo_suggestion_decisions`,
  );
  const done = new Set(decided.rows.map((d) => `${d.product_id} ${d.image}`));

  const pending: PendingSuggestion[] = [];
  for (const suggestion of suggestions) {
    const row = slugVariants(suggestion.slug).map((slug) => bySlug.get(slug)).find(Boolean);
    if (!row || done.has(`${row.id} ${suggestion.image}`)) continue;
    pending.push({
      ...suggestion,
      productId: row.id,
      productSlug: row.slug,
      name: row.name,
      currentImage: row.images[0] ?? "",
    });
  }
  return pending;
}

export type SuggestionResult =
  | { ok: true; slug: string; name: string; url?: string; added?: number; failedExtras?: number }
  | { ok: false; error: string };

/**
 * "Usar" o "Descartar". Solo acepta pares producto/foto que estén en la lista,
 * y de las vistas extra solo las que esa sugerencia trae: la ruta no sirve para
 * importar cualquier URL.
 */
export async function decideSuggestion(input: {
  slug: string;
  image: string;
  action: "usar" | "descartar";
  /** Vistas extra elegidas en el panel; las que no estén en la sugerencia se ignoran. */
  extras?: string[];
  suggestions?: PhotoSuggestion[];
  importImage?: (url: string, productName: string) => Promise<SaveImageResult>;
}): Promise<SuggestionResult> {
  const pending = await listPendingSuggestions(input.suggestions);
  const item = pending.find((p) => p.productSlug === input.slug && p.image === input.image);
  if (!item) return { ok: false, error: "Esa sugerencia ya no está pendiente." };

  let url: string | undefined;
  const added: string[] = [];
  let failedExtras = 0;
  if (input.action === "usar") {
    const importImage = input.importImage ?? importRemoteImage;
    const saved = await importImage(item.image, item.name);
    if (!saved.ok) return { ok: false, error: saved.error };
    url = saved.url;
    added.push(url);
    // Las vistas extra suman, pero si una falla no frena la principal.
    const chosen = (item.extras ?? []).filter((extra) => input.extras?.includes(extra));
    for (const result of await Promise.all(chosen.map((extra) => importImage(extra, item.name)))) {
      if (result.ok) added.push(result.url);
      else failedExtras++;
    }
    const [product] = await db
      .select({ images: products.images, imageSrcSets: products.imageSrcSets })
      .from(products)
      .where(eq(products.id, item.productId));
    if (!product) return { ok: false, error: "El producto ya no existe." };
    // Las nuevas van primeras; las anteriores quedan después, así no se pierde nada.
    await db
      .update(products)
      .set({
        images: [...added, ...product.images],
        imageSrcSets: [...added.map(() => []), ...product.images.map((_, i) => product.imageSrcSets[i] ?? [])],
      })
      .where(eq(products.id, item.productId));
    await clearPhotoFlagIfMainChanged(item.productId, product.images[0], url);
  }

  await db.execute(sql`
    insert into photo_suggestion_decisions (product_id, image, decision, decided_at)
    values (${item.productId}, ${item.image}, ${input.action === "usar" ? "usada" : "descartada"}, now())
    on conflict (product_id) do update
      set image = excluded.image, decision = excluded.decision, decided_at = now()`);
  return input.action === "usar"
    ? { ok: true, slug: item.productSlug, name: item.name, url, added: added.length, failedExtras }
    : { ok: true, slug: item.productSlug, name: item.name };
}
