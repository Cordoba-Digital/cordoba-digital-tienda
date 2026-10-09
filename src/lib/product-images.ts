import crypto from "node:crypto";

import { sql } from "drizzle-orm";

import { db } from "@/db";

/**
 * Fotos subidas desde el admin. Mientras no haya Vercel Blob se guardan en
 * Postgres y se sirven desde `/api/imagenes/<id>.<ext>` con caché larga (el id
 * es aleatorio y el archivo nunca cambia). El navegador ya las achica antes de
 * subirlas, así que cada una ocupa unos cientos de KB.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const UPLOADED_IMAGE_PATH = /^\/api\/imagenes\/[a-f0-9]{24}\.(jpg|png|webp|gif|avif)$/;

const TYPES = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
} as const;
type Ext = keyof typeof TYPES;

/** Tipo real según los primeros bytes: no confiamos en el nombre ni en el MIME del navegador. */
export function sniffImage(bytes: Buffer): Ext | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (bytes.toString("ascii", 0, 4) === "GIF8") return "gif";
  if (bytes.toString("ascii", 4, 8) === "ftyp" && /^avi[fs]$/.test(bytes.toString("ascii", 8, 12))) return "avif";
  return null;
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

export type SaveImageResult = { ok: true; url: string } | { ok: false; error: string };

export async function saveUploadedImage(bytes: Buffer): Promise<SaveImageResult> {
  if (!bytes.length) return { ok: false, error: "El archivo está vacío." };
  if (bytes.length > MAX_UPLOAD_BYTES) return { ok: false, error: "La foto supera los 4 MB." };
  const ext = sniffImage(bytes);
  if (!ext) return { ok: false, error: "Solo se aceptan fotos JPG, PNG, WebP, GIF o AVIF." };
  await ensureTable();
  const id = crypto.randomBytes(12).toString("hex");
  await db.execute(
    sql`insert into product_images (id, content_type, bytes, data) values (${id}, ${TYPES[ext]}, ${bytes.length}, ${bytes})`,
  );
  return { ok: true, url: `/api/imagenes/${id}.${ext}` };
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
