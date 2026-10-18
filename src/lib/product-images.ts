import crypto from "node:crypto";
import { lookup } from "node:dns/promises";
import net from "node:net";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { imageStore, putStoredImage } from "@/lib/image-storage";

/**
 * Fotos de producto guardadas por nosotros. Con Vercel Blob o Cloudflare R2
 * configurados (ver `image-storage.ts`) van ahí y se sirven desde su dominio
 * público; si no, van a Postgres y se sirven desde `/imagenes/<nombre-del-producto>-<id>.webp`. En
 * los dos casos con caché larga (el id es aleatorio y el archivo nunca
 * cambia). El nombre del archivo lleva el del producto porque Google lo usa
 * para entender la foto.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_REMOTE_BYTES = 10 * 1024 * 1024;
const MAX_SIDE = 1600;

/** Rutas propias: las nuevas (`/imagenes/...`) y las primeras subidas (`/api/imagenes/...`). */
export const UPLOADED_IMAGE_PATH =
  /^\/(api\/imagenes\/|imagenes\/(?:[a-z0-9]+(?:-[a-z0-9]+)*-)?)[a-f0-9]{24}\.(jpg|png|webp|gif|avif)$/;

const TYPES = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
} as const;
type Ext = keyof typeof TYPES;

/** Tipo real según los primeros bytes: no confiamos en el nombre ni en el MIME. */
export function sniffImage(bytes: Buffer): Ext | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (bytes.toString("ascii", 0, 4) === "GIF8") return "gif";
  if (bytes.toString("ascii", 4, 8) === "ftyp" && /^avi[fs]$/.test(bytes.toString("ascii", 8, 12))) return "avif";
  return null;
}

/** "Samsung Galaxy A55 5G 256GB" → "samsung-galaxy-a55-5g-256gb" */
export function imageSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/g, "");
}

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = db
      .execute(sql`create table if not exists product_images (
        id text primary key,
        content_type text not null,
        bytes integer not null,
        data bytea not null,
        created_at timestamptz not null default now()
      )`)
      .then(() => undefined)
      .catch((error) => {
        tableReady = null;
        throw error;
      });
  }
  return tableReady;
}

/**
 * Achica a 1600 px y pasa a WebP (respetando la rotación de la cámara). Los GIF
 * quedan como están para no perder la animación. Si sharp no está disponible
 * se guarda el original.
 */
async function optimize(bytes: Buffer, ext: Ext): Promise<{ bytes: Buffer; ext: Ext }> {
  if (ext === "gif") return { bytes, ext };
  try {
    const sharp = (await import("sharp")).default;
    const out = await sharp(bytes, { failOn: "error" })
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    return out.length < bytes.length || ext !== "webp" ? { bytes: out, ext: "webp" } : { bytes, ext };
  } catch {
    return { bytes, ext };
  }
}

export type SaveImageResult = { ok: true; url: string } | { ok: false; error: string };

export type PreparedImage = { ok: true; bytes: Buffer; ext: Ext; contentType: string } | { ok: false; error: string };

/** Valida el tipo real, achica y pasa a WebP. Lo usan la subida del admin y la migración de fotos. */
export async function prepareProductImage(raw: Buffer): Promise<PreparedImage> {
  if (!raw.length) return { ok: false, error: "El archivo está vacío." };
  const detected = sniffImage(raw);
  if (!detected) return { ok: false, error: "Solo se aceptan fotos JPG, PNG, WebP, GIF o AVIF." };
  const { bytes, ext } = await optimize(raw, detected);
  if (bytes.length > MAX_UPLOAD_BYTES) return { ok: false, error: "La foto supera los 4 MB." };
  return { ok: true, bytes, ext, contentType: TYPES[ext] };
}

/** Clave en Blob/R2: `productos/<nombre-del-producto>-<id>.<ext>`. */
export function productImageKey(productName: string, id: string, ext: string): string {
  return `productos/${imageSlug(productName) || "producto"}-${id}.${ext}`;
}

export async function saveUploadedImage(raw: Buffer, productName = ""): Promise<SaveImageResult> {
  const prepared = await prepareProductImage(raw);
  if (!prepared.ok) return prepared;
  const { bytes, ext, contentType } = prepared;
  const id = crypto.randomBytes(12).toString("hex");
  if (imageStore()) {
    try {
      return { ok: true, url: await putStoredImage(productImageKey(productName, id, ext), bytes, contentType) };
    } catch (error) {
      // Si Blob/R2 falla, la foto no se pierde: va a Postgres como antes.
      console.error("[product-images] no se pudo subir la foto, se guarda en la base", error);
    }
  }
  await ensureTable();
  await db.execute(
    sql`insert into product_images (id, content_type, bytes, data) values (${id}, ${contentType}, ${bytes.length}, ${bytes})`,
  );
  const slug = imageSlug(productName) || "producto";
  return { ok: true, url: `/imagenes/${slug}-${id}.${ext}` };
}

function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

/** Solo hosts públicos: el servidor no tiene que poder pedir nada de la red interna. */
export async function assertPublicHost(url: URL): Promise<void> {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("La URL tiene que empezar con http(s).");
  if (url.username || url.password) throw new Error("URL no permitida.");
  const addresses = await lookup(url.hostname, { all: true }).catch(() => []);
  if (!addresses.length) throw new Error("No se encontró el sitio de la foto.");
  if (addresses.some((a) => isPrivateAddress(a.address))) throw new Error("URL no permitida.");
}

/** Descarga una foto de otra web y guarda una copia propia. */
export async function importRemoteImage(rawUrl: string, productName = ""): Promise<SaveImageResult> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return { ok: false, error: "La URL no es válida." };
  }
  try {
    let res: Response | null = null;
    for (let hop = 0; hop < 4; hop += 1) {
      await assertPublicHost(url);
      res = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(10_000),
        headers: { Accept: "image/avif,image/webp,image/*;q=0.8", "User-Agent": "Mozilla/5.0 (compatible; CordobaDigitalAdmin/1.0)" },
      });
      const next = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
      if (!next) break;
      url = new URL(next, url);
      res = null;
    }
    if (!res) return { ok: false, error: "La foto redirige demasiadas veces." };
    if (!res.ok || !res.body) return { ok: false, error: `El sitio de la foto respondió ${res.status}.` };
    if (Number(res.headers.get("content-length") ?? 0) > MAX_REMOTE_BYTES) {
      return { ok: false, error: "La foto supera los 10 MB." };
    }
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      total += chunk.length;
      if (total > MAX_REMOTE_BYTES) return { ok: false, error: "La foto supera los 10 MB." };
      chunks.push(Buffer.from(chunk));
    }
    return saveUploadedImage(Buffer.concat(chunks), productName);
  } catch (error) {
    if (error instanceof Error && /no permitida|http\(s\)|No se encontró/.test(error.message)) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "No se pudo descargar la foto." };
  }
}

export async function readUploadedImage(id: string): Promise<{ contentType: string; data: Buffer } | null> {
  if (!/^[a-f0-9]{24}$/.test(id)) return null;
  await ensureTable();
  const result = await db.execute<{ content_type: string; data: Buffer }>(
    sql`select content_type, data from product_images where id = ${id} limit 1`,
  );
  const row = result.rows[0];
  return row ? { contentType: row.content_type, data: row.data } : null;
}
