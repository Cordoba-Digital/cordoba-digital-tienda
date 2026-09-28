/**
 * Copia las imágenes de producto desde el servidor viejo de WordPress a este
 * proyecto, para que la tienda no dependa de que ese hosting siga en pie.
 *
 * Por defecto solo mide (`--measure`). Para copiar de verdad:
 *   npm run images:migrate -- --yes
 *
 * Opciones:
 *   --dest=public/images/products   carpeta destino
 *   --concurrency=6                descargas simultáneas
 *   --extreme                      además genera derivados optimizados
 */
import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const STORE_URL = (process.env.WC_STORE_URL ?? "https://www.cordobadigital.net").replace(/\/+$/, "");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function arg(name: string, fallback?: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1] : fallback;
}

const DEST = path.resolve(process.cwd(), arg("dest", "public/images/products")!);
const CONCURRENCY = Number(arg("concurrency", "6"));
const APPLY = process.argv.includes("--yes");
const MEASURE_SAMPLE = Number(arg("sample", "60"));

type Row = { slug: string; images: string[]; categorySlug: string };

/** Nombre destino estable y sin colisiones: <slug>__<índice>.<ext> */
function targetName(slug: string, index: number, url: string): string {
  const ext = (path.extname(new URL(url).pathname) || ".jpg").toLowerCase();
  const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"].includes(ext) ? ext : ".jpg";
  return `${slug}${index > 0 ? `-${index + 1}` : ""}${safeExt}`;
}

async function head(url: string): Promise<{ size: number; type: string } | null> {
  try {
    const res = await fetch(url, { method: "HEAD", headers: { "user-agent": UA } });
    if (!res.ok) return null;
    return { size: Number(res.headers.get("content-length") ?? 0), type: res.headers.get("content-type") ?? "" };
  } catch {
    return null;
  }
}

async function pool<T, R>(items: T[], worker: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      for (;;) {
        const i = cursor++;
        if (i >= items.length) return;
        out[i] = await worker(items[i]);
      }
    }),
  );
  return out;
}

async function main() {
  const { db, pool: pgPool } = await import("@/db");
  const { products } = await import("@/db/schema");

  const rows = (await db.select({ slug: products.slug, images: products.images, categorySlug: products.categorySlug }).from(products)) as Row[];

  // Una URL por producto, sin duplicados: es lo que realmente hay que traer.
  const jobs: { slug: string; index: number; url: string; local: string }[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    (row.images ?? []).forEach((url, index) => {
      if (!url || !url.startsWith("http") || seen.has(url)) return;
      seen.add(url);
      jobs.push({ slug: row.slug, index, url, local: targetName(row.slug, index, url) });
    });
  }
  console.log(`[images] productos: ${rows.length}`);
  console.log(`[images] imágenes únicas a copiar: ${jobs.length}`);
  console.log(`[images] destino: ${path.relative(process.cwd(), DEST)}`);
  console.log(`[images] origen: ${STORE_URL}/wp-content/...`);

  // ── Medida: tamaño real de una muestra para estimar el total ──────────
  const sample = jobs.filter((_, i) => i % Math.max(1, Math.floor(jobs.length / MEASURE_SAMPLE)) === 0).slice(0, MEASURE_SAMPLE);
  console.log(`\n[images] midiendo ${sample.length} imágenes…`);
  const heads = await pool(sample, (job) => head(job.url));
  const measured = heads.filter(Boolean) as { size: number; type: string }[];
  const withSize = measured.filter((m) => m.size > 0);
  const avg = withSize.length ? withSize.reduce((a, b) => a + b.size, 0) / withSize.length : 0;
  const max = withSize.length ? Math.max(...withSize.map((m) => m.size)) : 0;
  const estimate = Math.round((avg * jobs.length) / (1024 * 1024));
  const biggest = withSize.length
    ? sample[withSize.reduce((best, m, i) => (m.size > withSize[best].size ? i : best), 0)]
    : undefined;
  console.log(`[images] promedio: ${Math.round(avg / 1024)} KB · máximo: ${Math.round(max / 1024)} KB`);
  console.log(`[images] estimación total: ~${estimate} MB para ${jobs.length} imágenes`);
  if (biggest) console.log(`[images] archivo más grande de la muestra: ${path.basename(new URL(biggest.url).pathname)}`);
  const notFound = heads.filter((h) => h === null).length;
  if (notFound) console.log(`[images] ⚠️ ${notFound} de la muestra ya no responden en el servidor viejo`);

  if (!APPLY) {
    console.log("\n[images] --measure (por defecto): no se descargó nada.");
    console.log("[images] Para copiar de verdad: npm run images:migrate -- --yes");
    await pgPool.end();
    return;
  }

  // ── Copia real ──────────────────────────────────────────────────────
  await mkdir(DEST, { recursive: true });
  const manifest: { slug: string; local: string; source: string; bytes: number }[] = [];
  let ok = 0;
  let fail = 0;
  let bytes = 0;

  await pool(jobs, async (job) => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(job.url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(45_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        await writeFile(path.join(DEST, job.local), buf);
        manifest.push({ slug: job.slug, local: job.local, source: job.url, bytes: buf.byteLength });
        ok++;
        bytes += buf.byteLength;
        break;
      } catch (error) {
        if (attempt === 3) {
          fail++;
          console.error(`[images] ERROR ${job.url}: ${(error as Error).message}`);
        } else {
          await new Promise((r) => setTimeout(r, attempt * 800));
        }
      }
    }
    if (ok % 200 === 0) console.log(`[images] ${ok}/${jobs.length} descargadas (${Math.round(bytes / 1024 / 1024)} MB)`);
  });

  const manifestPath = path.join(DEST, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 0), "utf8");
  console.log(`[images] ${ok} descargadas, ${fail} fallidas, ${Math.round(bytes / 1024 / 1024)} MB`);
  console.log(`[images] manifiesto: ${path.relative(process.cwd(), manifestPath)}`);

  // ── Reescribe la base para apuntar a la copia local ───────────────────
  console.log(`[images] actualizando products.images a rutas locales…`);
  const { eq } = await import("drizzle-orm");
  const bySlug = new Map<string, string[]>();
  for (const entry of manifest) {
    bySlug.set(entry.slug, [...(bySlug.get(entry.slug) ?? []), entry.local]);
  }
  let updated = 0;
  for (const [slug, locals] of bySlug) {
    await db.update(products).set({ images: locals.map((l) => `/images/products/${l}`) }).where(eq(products.slug, slug));
    updated++;
    if (updated % 200 === 0) console.log(`[images] ${updated}/${bySlug.size} productos actualizados`);
  }
  console.log(`[images] ${updated} productos actualizados.`);
  await pgPool.end();
}

main().catch((error) => {
  console.error(`[images] FATAL: ${(error as Error).message}`);
  process.exit(1);
});
