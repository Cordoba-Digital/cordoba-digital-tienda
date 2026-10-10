import { AwsClient } from "aws4fetch";

/**
 * Cloudflare R2 (API compatible con S3) para las fotos de producto. Se activa
 * con las cinco variables R2_* y tiene prioridad sobre Vercel Blob (ver
 * `image-storage.ts`). Las fotos se sirven directo desde
 * R2_PUBLIC_URL (dominio propio o r2.dev), sin pasar por las funciones de Vercel.
 */
type R2Config = { endpoint: string; publicUrl: string; client: AwsClient };

let cached: R2Config | null | undefined;

export function r2Config(): R2Config | null {
  if (cached !== undefined) return cached;
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  const publicUrl = process.env.R2_PUBLIC_URL?.trim().replace(/\/+$/, "");
  cached =
    accountId && accessKeyId && secretAccessKey && bucket && publicUrl
      ? {
          // R2_ENDPOINT solo hace falta para buckets con jurisdicción (p. ej. `.eu.`).
          endpoint: `${process.env.R2_ENDPOINT?.trim().replace(/\/+$/, "") || `https://${accountId}.r2.cloudflarestorage.com`}/${bucket}`,
          publicUrl,
          client: new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" }),
        }
      : null;
  return cached;
}

/** `true` si la URL ya es una foto nuestra en R2. */
export function isR2Url(url: string): boolean {
  const config = r2Config();
  return !!config && url.startsWith(`${config.publicUrl}/`);
}

/**
 * Sube un archivo y devuelve su URL pública. Las claves llevan un id aleatorio
 * o un hash, así que el archivo nunca cambia: caché de un año.
 */
export async function putR2Object(key: string, body: Buffer, contentType: string): Promise<string> {
  const config = r2Config();
  if (!config) throw new Error("R2 no está configurado.");
  const path = key.split("/").map(encodeURIComponent).join("/");
  const res = await config.client.fetch(`${config.endpoint}/${path}`, {
    method: "PUT",
    body: new Uint8Array(body),
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
  if (!res.ok) throw new Error(`R2 respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return `${config.publicUrl}/${path}`;
}
