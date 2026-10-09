/**
 * Copia las fotos de producto del WordPress viejo a Cloudflare R2 y apunta los
 * productos a la copia, para poder apagar el WordPress.
 *
 *   npm run images:migrate                 # solo cuenta lo pendiente, no escribe
 *   npm run images:migrate -- --yes --limit=20   # prueba con 20 productos
 *   npm run images:migrate -- --yes        # todo el catálogo
 *
 * Opciones: --limit=N (productos), --concurrency=4 (productos a la vez).
 *
 * Cada foto se baja (el original de WP si existe, si no la variante guardada),
 * se achica a 1600 px en WebP como las que se suben desde el panel y se sube a
 * `productos/<nombre-del-producto>-<hash>.webp`. El hash sale de la URL de
 * origen, así que volver a correrlo no duplica nada: retoma donde quedó, porque
 * los productos ya migrados tienen URLs de R2 y se saltean. Una foto que falla
 * queda con su URL vieja y se reintenta en la próxima corrida.
 *
 * Requiere DATABASE_URL y las variables R2_* (ver .env.example). Escribe en
 * `products.images` e `image_srcsets`: hacer un backup de la base antes.
 */
import "dotenv/config";

import crypto from "node:crypto";

import { eq } from "drizzle-orm";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;

function arg(name: string, fallback?: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1] : fallback;
}

const APPLY = process.argv.includes("--yes");
const LIMIT = Number(arg("limit", "0")) || Infinity;
const CONCURRENCY = Math.max(1, Number(arg("concurrency", "4")));

/** WooCommerce agrega `-800x800` a las variantes: sin eso queda el original. */
function originalOf(url: string): string {
  return url.replace(/-\d+x\d+(?=\.[a-z0-9]+(?:\?.*)?$)/i, "");
}

async function download(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length && buf.length <= MAX_DOWNLOAD_BYTES ? buf : null;
  } catch {
    return null;
  }
}

async function main() {
  const { db, pool } = await import("@/db");
  const { products } = await import("@/db/schema");
  const { isR2Url, putR2Object, r2Config } = await import("@/lib/r2");
  const { prepareProductImage, productImageKey } = await import("@/lib/product-images");

  if (APPLY && !r2Config()) {
    console.error("[images] Faltan variables R2_* (ver .env.example): no se puede subir.");
    process.exit(1);
  }

  const rows = await db
    .select({ id: products.id, name: products.name, images: products.images, imageSrcSets: products.imageSrcSets })
    .from(products)
    .orderBy(products.id);

  const pendingOf = (images: string[]) =>
    images.map((url, i) => ({ url, i })).filter(({ url }) => url.startsWith("http") && !isR2Url(url));
  const todo = rows.filter((r) => pendingOf(r.images ?? []).length > 0);
  const pendingImages = todo.reduce((n, r) => n + pendingOf(r.images).length, 0);

  console.log(`[images] productos: ${rows.length} · con fotos por migrar: ${todo.length} · fotos: ${pendingImages}`);
  if (!APPLY) {
    console.log("[images] Modo prueba: no se bajó ni se escribió nada. Para copiar: npm run images:migrate -- --yes");
    await pool.end();
    return;
  }

  const batch = todo.slice(0, LIMIT);
  let done = 0;
  let copied = 0;
  let failed = 0;
  let bytes = 0;

  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, batch.length) }, async () => {
      for (;;) {
        const row = batch[cursor++];
        if (!row) return;
        const images = [...row.images];
        const srcSets = [...(row.imageSrcSets ?? [])];
        let changed = false;
        for (const { url, i } of pendingOf(row.images)) {
          const original = originalOf(url);
          const raw = (original !== url ? await download(original) : null) ?? (await download(url));
          const prepared = raw ? await prepareProductImage(raw) : null;
          if (!prepared?.ok) {
            failed++;
            console.error(`[images] falló ${url}${prepared && !prepared.ok ? `: ${prepared.error}` : ""}`);
            continue;
          }
          const id = crypto.createHash("sha256").update(url).digest("hex").slice(0, 24);
          try {
            images[i] = await putR2Object(productImageKey(row.name, id, prepared.ext), prepared.bytes, prepared.contentType);
          } catch (error) {
            failed++;
            console.error(`[images] no se pudo subir ${url}: ${(error as Error).message}`);
            continue;
          }
          // El srcset apuntaba a variantes del WordPress; la copia es una sola foto.
          if (i < srcSets.length) srcSets[i] = [];
          changed = true;
          copied++;
          bytes += prepared.bytes.length;
        }
        if (changed) {
          await db.update(products).set({ images, imageSrcSets: srcSets }).where(eq(products.id, row.id));
        }
        done++;
        if (done % 50 === 0 || done === batch.length) {
          console.log(`[images] ${done}/${batch.length} productos · ${copied} fotos (${Math.round(bytes / 1024 / 1024)} MB) · ${failed} fallas`);
        }
      }
    }),
  );

  console.log(`[images] Listo: ${copied} fotos copiadas, ${failed} fallas.`);
  if (failed) console.log("[images] Las fallas quedaron con su URL vieja: volver a correrlo las reintenta.");
  await pool.end();
}

main().catch((error) => {
  console.error(`[images] FATAL: ${(error as Error).message}`);
  process.exit(1);
});
