import { sql } from "drizzle-orm";

import { db } from "@/db";
import { imageSizeFromHeader, SMALL_PHOTO_PX, type ImageSize } from "@/lib/image-dimensions";
import { assertPublicHost, readUploadedImage, UPLOADED_IMAGE_PATH } from "@/lib/product-images";

/**
 * Revisión de fotos del catálogo desde el panel:
 * - mide la foto principal de cada producto (para el filtro "Fotos chicas"),
 * - guarda la marca "hay que cambiar la foto" que pone César al recorrer la lista.
 *
 * Todo vive en `product_photo_checks`. La tabla se crea sola al primer uso
 * (además de la migración 0009), así el panel no se rompe si el código llega
 * a producción antes que la migración.
 */

let tableReady: Promise<void> | null = null;
export function ensurePhotoChecksTable(): Promise<void> {
  if (!tableReady) {
    tableReady = db
      .execute(sql`create table if not exists product_photo_checks (
        product_id integer primary key,
        url text not null default '',
        width integer,
        height integer,
        flagged boolean not null default false,
        checked_at timestamptz not null default now()
      )`)
      .then(() => undefined)
      .catch((error) => {
        tableReady = null;
        throw error;
      });
  }
  return tableReady;
}

/** Filtros de fotos de la lista de productos del panel. */
export type PhotoFilter = "" | "sin" | "chicas" | "marcadas" | "sin-medir";

export function parsePhotoFilter(value: string | null | undefined): PhotoFilter {
  return value === "sin" || value === "chicas" || value === "marcadas" || value === "sin-medir" ? value : "";
}

/** Condición SQL sobre `products` para cada filtro. La medición vale solo si es de la foto principal actual. */
export function photoFilterClause(filter: PhotoFilter) {
  const main = sql`products.images->>0`;
  switch (filter) {
    case "sin":
      return sql`jsonb_array_length(products.images) = 0`;
    case "chicas":
      return sql`exists (select 1 from product_photo_checks c where c.product_id = products.id and c.url = ${main}
        and greatest(c.width, c.height) < ${SMALL_PHOTO_PX})`;
    case "marcadas":
      return sql`exists (select 1 from product_photo_checks c where c.product_id = products.id and c.flagged)`;
    case "sin-medir":
      return sql`jsonb_array_length(products.images) > 0 and not exists (select 1 from product_photo_checks c
        where c.product_id = products.id and c.url = ${main} and c.width is not null)`;
    default:
      return null;
  }
}

// ─── Medición ────────────────────────────────────────────────────────

const HEADER_BYTES = 64 * 1024;
const MAX_FULL_BYTES = 10 * 1024 * 1024;
// Algunos hostings (el WordPress viejo) responden 403 sin un User-Agent de navegador.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function sizeWithSharp(bytes: Buffer): Promise<ImageSize | null> {
  try {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(bytes).metadata();
    return meta.width && meta.height ? { width: meta.width, height: meta.height } : null;
  } catch {
    return null;
  }
}

/** Lee el cuerpo hasta `limit` bytes; avisa si quedó cortado. */
async function readUpTo(res: Response, limit: number): Promise<{ bytes: Buffer; truncated: boolean }> {
  const chunks: Buffer[] = [];
  let total = 0;
  if (!res.body) return { bytes: Buffer.alloc(0), truncated: false };
  const reader = res.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return { bytes: Buffer.concat(chunks), truncated: false };
      chunks.push(Buffer.from(value));
      total += value.length;
      if (total >= limit) return { bytes: Buffer.concat(chunks).subarray(0, limit), truncated: true };
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

/** Pide una foto a otro sitio con hasta 3 redirecciones, revisando cada destino. */
async function fetchRemote(rawUrl: string, range: boolean): Promise<Response> {
  let url = new URL(rawUrl);
  for (let hop = 0; hop < 4; hop += 1) {
    await assertPublicHost(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
      headers: { "User-Agent": UA, Accept: "image/*", ...(range ? { Range: `bytes=0-${HEADER_BYTES - 1}` } : {}) },
    });
    const next = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    if (!next) return res;
    url = new URL(next, url);
  }
  throw new Error("redirige demasiadas veces");
}

/**
 * Ancho y alto de una foto del catálogo. Primero pide los primeros 64 KB y lee
 * la cabecera; si no alcanza (AVIF, cabeceras raras), baja el archivo entero y
 * lo mide con sharp. Tira error con un motivo corto si no se puede.
 */
export async function measurePhoto(url: string): Promise<ImageSize> {
  if (url.startsWith("/")) {
    const id = UPLOADED_IMAGE_PATH.test(url) ? url.match(/([a-f0-9]{24})\.[a-z]+$/)?.[1] : undefined;
    const stored = id ? await readUploadedImage(id) : null;
    if (!stored) throw new Error("no está guardada");
    const size = imageSizeFromHeader(stored.data) ?? (await sizeWithSharp(stored.data));
    if (!size) throw new Error("formato no reconocido");
    return size;
  }
  if (!/^https?:\/\//i.test(url)) throw new Error("dirección no válida");

  const res = await fetchRemote(url, true);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const head = await readUpTo(res, HEADER_BYTES);
  const fromHeader = imageSizeFromHeader(head.bytes);
  if (fromHeader) return fromHeader;
  // El servidor ignoró el Range y mandó todo, o la cabecera no alcanzó: archivo entero.
  let full = head.bytes;
  if (head.truncated || res.status === 206) {
    const whole = await fetchRemote(url, false);
    if (!whole.ok) throw new Error(`HTTP ${whole.status}`);
    const body = await readUpTo(whole, MAX_FULL_BYTES);
    if (body.truncated) throw new Error("demasiado grande");
    full = body.bytes;
  }
  const size = await sizeWithSharp(full);
  if (!size) throw new Error("formato no reconocido");
  return size;
}

export type MeasureBatch = {
  /** Productos que se intentaron medir en esta tanda. */
  products: number;
  measured: number;
  failed: number;
  failedProductIds: number[];
  errors: string[];
  /** Productos con foto que siguen sin medir (sin contar los que fallaron en esta corrida). */
  remaining: number;
};

const CONCURRENCY = 8;

/**
 * Mide una tanda de fotos principales sin medir (o que cambiaron desde la
 * última medición) hasta agotar `timeBudgetMs`. `skip` son los productos que
 * ya fallaron en esta corrida, para no reintentarlos en loop.
 */
export async function measurePhotosBatch(input: {
  timeBudgetMs: number;
  skip?: number[];
  measure?: (url: string) => Promise<ImageSize>;
}): Promise<MeasureBatch> {
  await ensurePhotoChecksTable();
  const measure = input.measure ?? measurePhoto;
  const skip = input.skip ?? [];
  const skipClause = skip.length ? sql`and p.id not in (${sql.join(skip.map((id) => sql`${id}`), sql`, `)})` : sql``;
  const pending = await db.execute<{ id: number; name: string; url: string }>(sql`
    select p.id, p.name, p.images->>0 as url
    from products p
    left join product_photo_checks c on c.product_id = p.id
    where jsonb_array_length(p.images) > 0
      and (c.product_id is null or c.url is distinct from p.images->>0 or c.width is null)
      ${skipClause}
    order by p.id
    limit 400`);

  const deadline = Date.now() + input.timeBudgetMs;
  const queue = [...pending.rows];
  let attempted = 0;
  let measured = 0;
  const failedProductIds: number[] = [];
  const errors: string[] = [];

  async function worker() {
    for (;;) {
      if (Date.now() >= deadline) return;
      const row = queue.shift();
      if (!row) return;
      attempted += 1;
      try {
        const { width, height } = await measure(row.url);
        await db.execute(sql`
          insert into product_photo_checks (product_id, url, width, height, checked_at)
          values (${row.id}, ${row.url}, ${width}, ${height}, now())
          on conflict (product_id) do update
            set url = excluded.url, width = excluded.width, height = excluded.height, checked_at = now()`);
        measured += 1;
      } catch (error) {
        failedProductIds.push(row.id);
        errors.push(`${row.name}: ${error instanceof Error ? error.message : "no se pudo medir"}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const allSkipped = [...skip, ...failedProductIds];
  const remainingSkip = allSkipped.length
    ? sql`and p.id not in (${sql.join(allSkipped.map((id) => sql`${id}`), sql`, `)})`
    : sql``;
  const [left] = (
    await db.execute<{ n: number }>(sql`
      select count(*)::int as n from products p
      left join product_photo_checks c on c.product_id = p.id
      where jsonb_array_length(p.images) > 0
        and (c.product_id is null or c.url is distinct from p.images->>0 or c.width is null)
        ${remainingSkip}`)
  ).rows;

  return {
    products: attempted,
    measured,
    failed: failedProductIds.length,
    failedProductIds,
    errors: errors.slice(0, 30),
    remaining: left?.n ?? 0,
  };
}

// ─── Resumen y marca ─────────────────────────────────────────────────

export type PhotoCheckStatus = {
  withPhoto: number;
  noPhoto: number;
  small: number;
  flagged: number;
  unmeasured: number;
};

export async function photoCheckStatus(): Promise<PhotoCheckStatus> {
  await ensurePhotoChecksTable();
  const [row] = (
    await db.execute<PhotoCheckStatus>(sql`
      select
        count(*) filter (where jsonb_array_length(p.images) > 0)::int as "withPhoto",
        count(*) filter (where jsonb_array_length(p.images) = 0)::int as "noPhoto",
        count(*) filter (where c.url = p.images->>0 and greatest(c.width, c.height) < ${SMALL_PHOTO_PX})::int as "small",
        count(*) filter (where c.flagged)::int as "flagged",
        count(*) filter (where jsonb_array_length(p.images) > 0
          and (c.product_id is null or c.url is distinct from p.images->>0 or c.width is null))::int as "unmeasured"
      from products p
      left join product_photo_checks c on c.product_id = p.id`)
  ).rows;
  return row ?? { withPhoto: 0, noPhoto: 0, small: 0, flagged: 0, unmeasured: 0 };
}

/** Marca o desmarca "hay que cambiar la foto". */
export async function setPhotoFlag(productId: number, flagged: boolean): Promise<void> {
  await ensurePhotoChecksTable();
  await db.execute(sql`
    insert into product_photo_checks (product_id, flagged) values (${productId}, ${flagged})
    on conflict (product_id) do update set flagged = excluded.flagged`);
}

/** Al cambiar la foto principal, la marca se da por resuelta. */
export async function clearPhotoFlagIfMainChanged(productId: number, before: string | undefined, after: string | undefined) {
  if ((before ?? "") === (after ?? "")) return;
  await ensurePhotoChecksTable();
  await db.execute(sql`update product_photo_checks set flagged = false where product_id = ${productId} and flagged`);
}
