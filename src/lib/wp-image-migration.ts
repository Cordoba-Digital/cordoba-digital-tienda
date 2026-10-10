import crypto from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { products } from "@/db/schema";
import { imageStore, isStoredImageUrl, putStoredImage } from "@/lib/image-storage";
import { prepareProductImage, productImageKey } from "@/lib/product-images";

/**
 * Copia las fotos de producto que todavía salen del WordPress viejo al
 * almacenamiento propio (Vercel Blob o R2) y apunta los productos a la copia.
 *
 * Cada foto se baja (el original de WP si existe, si no la variante guardada),
 * se achica a 1600 px en WebP como las que se suben desde el panel y se guarda
 * en `productos/<nombre-del-producto>-<hash>.webp`. El hash sale de la URL de
 * origen, así que repetir no duplica nada. Trabaja por tandas: los productos
 * ya migrados tienen URLs propias y se saltean, y una foto que falla queda con
 * su URL vieja para reintentarla en la próxima tanda.
 */

// El WordPress responde 403 "browser outdated" sin un User-Agent moderno.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;

type Row = { id: number; name: string; images: string[]; imageSrcSets: string[][] };

function pendingOf(images: string[]): { url: string; i: number }[] {
  return images.map((url, i) => ({ url, i })).filter(({ url }) => url.startsWith("http") && !isStoredImageUrl(url));
}

/** WooCommerce agrega `-800x800` a las variantes: sin eso queda el original. */
function originalOf(url: string): string {
  return url.replace(/-\d+x\d+(?=\.[a-z0-9]+(?:\?.*)?$)/i, "");
}

async function download(url: string): Promise<{ buf: Buffer } | { status: string }> {
  try {
    const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return { status: `HTTP ${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) return { status: "vacía" };
    if (buf.length > MAX_DOWNLOAD_BYTES) return { status: "demasiado grande" };
    return { buf };
  } catch (error) {
    return { status: (error as Error).name === "TimeoutError" ? "tardó demasiado" : "no responde" };
  }
}

async function loadPending(): Promise<Row[]> {
  const rows = await db
    .select({ id: products.id, name: products.name, images: products.images, imageSrcSets: products.imageSrcSets })
    .from(products)
    .orderBy(products.id);
  return rows.filter((r) => pendingOf(r.images ?? []).length > 0);
}

export type WpImageStatus = { store: string | null; pendingProducts: number; pendingImages: number };

export async function wpImageStatus(): Promise<WpImageStatus> {
  const pending = await loadPending();
  return {
    store: imageStore(),
    pendingProducts: pending.length,
    pendingImages: pending.reduce((n, r) => n + pendingOf(r.images).length, 0),
  };
}

export type WpImageBatch = {
  products: number;
  copied: number;
  failed: number;
  bytes: number;
  errors: string[];
  remainingProducts: number;
};

/**
 * Procesa productos hasta agotar `timeBudgetMs` o `maxProducts`. `skip` son
 * los ids que ya fallaron en esta corrida, para no reintentarlos en bucle.
 */
export async function migrateWpImages(opts: {
  timeBudgetMs: number;
  maxProducts?: number;
  concurrency?: number;
  skip?: number[];
}): Promise<WpImageBatch & { failedProductIds: number[] }> {
  if (!imageStore()) throw new Error("No hay almacenamiento de fotos configurado.");
  const deadline = Date.now() + opts.timeBudgetMs;
  const skip = new Set(opts.skip ?? []);
  const queue = (await loadPending()).filter((r) => !skip.has(r.id)).slice(0, opts.maxProducts ?? Infinity);

  const result: WpImageBatch & { failedProductIds: number[] } = {
    products: 0,
    copied: 0,
    failed: 0,
    bytes: 0,
    errors: [],
    remainingProducts: 0,
    failedProductIds: [],
  };

  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(opts.concurrency ?? 4, queue.length)) }, async () => {
      while (cursor < queue.length && Date.now() < deadline) {
        const row = queue[cursor++];
        const images = [...row.images];
        const srcSets = [...(row.imageSrcSets ?? [])];
        let changed = false;
        let rowFailed = false;
        for (const { url, i } of pendingOf(row.images)) {
          const original = originalOf(url);
          let got = original !== url ? await download(original) : null;
          if (!got || !("buf" in got)) got = await download(url);
          const prepared = "buf" in got ? await prepareProductImage(got.buf) : null;
          if (!prepared?.ok) {
            rowFailed = true;
            result.failed++;
            const why = "status" in got ? got.status : prepared && !prepared.ok ? prepared.error : "error";
            if (result.errors.length < 20) result.errors.push(`${row.name}: ${why}`);
            continue;
          }
          const id = crypto.createHash("sha256").update(url).digest("hex").slice(0, 24);
          try {
            images[i] = await putStoredImage(productImageKey(row.name, id, prepared.ext), prepared.bytes, prepared.contentType);
          } catch (error) {
            rowFailed = true;
            result.failed++;
            if (result.errors.length < 20) result.errors.push(`${row.name}: no se pudo guardar (${(error as Error).message.slice(0, 120)})`);
            continue;
          }
          // El srcset apuntaba a variantes del WordPress; la copia es una sola foto.
          if (i < srcSets.length) srcSets[i] = [];
          changed = true;
          result.copied++;
          result.bytes += prepared.bytes.length;
        }
        if (changed) {
          await db.update(products).set({ images, imageSrcSets: srcSets }).where(eq(products.id, row.id));
        }
        if (rowFailed) result.failedProductIds.push(row.id);
        result.products++;
      }
    }),
  );

  result.remainingProducts = (await loadPending()).length;
  return result;
}
