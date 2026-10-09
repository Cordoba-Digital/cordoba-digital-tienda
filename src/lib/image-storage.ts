import { put } from "@vercel/blob";

import { isR2Url, putR2Object, r2Config } from "@/lib/r2";

/**
 * Dónde se guardan las fotos de producto, en orden de preferencia:
 * - Cloudflare R2, si están las variables R2_* (ver `r2.ts`).
 * - Vercel Blob, si está BLOB_READ_WRITE_TOKEN (lo carga Vercel al conectar el store).
 * - Si no hay ninguno, `product-images.ts` las guarda en Postgres.
 */
export type ImageStore = "r2" | "blob";

export function imageStore(): ImageStore | null {
  if (r2Config()) return "r2";
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) return "blob";
  return null;
}

const BLOB_HOST = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i;

/** `true` si la URL ya es una foto guardada por nosotros (R2 o Blob). */
export function isStoredImageUrl(url: string): boolean {
  return BLOB_HOST.test(url) || isR2Url(url);
}

/**
 * Sube un archivo y devuelve su URL pública. Las claves llevan un id aleatorio
 * o un hash, así que el archivo nunca cambia: caché de un año.
 */
export async function putStoredImage(key: string, body: Buffer, contentType: string): Promise<string> {
  const store = imageStore();
  if (store === "r2") return putR2Object(key, body, contentType);
  if (store === "blob") {
    const blob = await put(key, body, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 31_536_000,
    });
    return blob.url;
  }
  throw new Error("No hay almacenamiento de fotos configurado.");
}
