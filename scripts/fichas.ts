/**
 * Carga fichas de producto mejoradas (descripción, SEO, destacados y
 * características) desde un lote en `data/fichas/<lote>.json`.
 *
 * Por qué existe: los 2.588 productos vinieron de WooCommerce con el título y la
 * descripción SEO vacíos (Rank Math no está en la Store API), la tabla de
 * características vacía y descripciones copiadas de fabricantes (texto cortado,
 * restos como "[cite: 1]", datos de otro modelo). Las fichas se reescriben por
 * lotes, se revisan en el PR y recién después se cargan.
 *
 * Solo toca los campos que el lote trae: name, brand, model, storage, ram,
 * seoTitle, seoDescription, shortDescription, highlights, specs y
 * descriptionHtml (de la que también sale `description` en texto plano). NO
 * toca precio, stock, imágenes ni categorías. `revisar` son notas para quien
 * aprueba: no se escriben.
 *
 * Una ficha cargada queda con `seoTitle`, y eso la marca como curada:
 * `migrate:wp` ya no pisa sus textos (ver `productUpsertSet` en migrate-wp.ts).
 *
 * Uso:
 *   npm run fichas -- lote-1            # modo prueba: muestra antes y después, no escribe
 *   npm run fichas -- lote-1 --apply    # escribe todo el lote en una transacción
 *
 * Envs: DATABASE_URL (requerida)
 */
import "dotenv/config";

import { readFileSync } from "node:fs";
import path from "node:path";

import { eq, sql } from "drizzle-orm";

import { products } from "@/db/schema";
import { sanitizeHtml } from "@/lib/sanitize-html";

type Spec = { label: string; value: string };
type Ficha = {
  slug: string;
  name?: string;
  brand?: string;
  model?: string;
  storage?: string;
  ram?: string;
  seoTitle?: string;
  seoDescription?: string;
  shortDescription?: string;
  highlights?: string[];
  specs?: Spec[];
  descriptionHtml?: string;
  revisar?: string[];
};
/**
 * `soloSinCurar`: lote de limpieza automática (ver `scripts/fichas-limpieza.py`).
 * Saltea las fichas que ya tienen `seoTitle`, para no pisar una ficha reescrita
 * aunque el lote de limpieza se cargue después.
 */
type Lote = { lote: string; soloSinCurar?: boolean; productos: Ficha[] };

/** El layout agrega " · Córdoba Digital" (19 caracteres) y Google corta cerca de 60. */
const MAX_SEO_TITLE = 45;
/** Google corta la descripción cerca de 155-160 caracteres. */
const MAX_SEO_DESCRIPTION = 160;

const CAMPOS_TEXTO = ["name", "brand", "model", "storage", "ram", "seoTitle", "seoDescription", "shortDescription"] as const;

function stripHtml(html: string): string {
  return html
    .replace(/<\/(p|h\d|li)>/g, "$&\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*/g, "\n")
    .trim();
}

/** Devuelve los problemas de forma de una ficha; vacío si está bien. */
export function validarFicha(f: Ficha): string[] {
  const errores: string[] = [];
  if (!f.slug) errores.push("falta slug");
  if (f.seoTitle && f.seoTitle.length > MAX_SEO_TITLE) errores.push(`seoTitle de ${f.seoTitle.length} caracteres (máx. ${MAX_SEO_TITLE})`);
  if (f.seoDescription && f.seoDescription.length > MAX_SEO_DESCRIPTION) {
    errores.push(`seoDescription de ${f.seoDescription.length} caracteres (máx. ${MAX_SEO_DESCRIPTION})`);
  }
  for (const s of f.specs ?? []) if (!s.label?.trim() || !s.value?.trim()) errores.push("spec sin label o value");
  const todo = JSON.stringify(f);
  if (/\[cite:/i.test(todo)) errores.push("quedó un '[cite: N]'");
  return errores;
}

function valores(f: Ficha) {
  const set: Record<string, unknown> = {};
  for (const campo of CAMPOS_TEXTO) if (typeof f[campo] === "string") set[campo] = (f[campo] as string).trim();
  if (f.highlights) set.highlights = f.highlights.map((h) => h.trim()).filter(Boolean);
  if (f.specs) set.specs = f.specs.map((s) => ({ label: s.label.trim(), value: s.value.trim() }));
  if (typeof f.descriptionHtml === "string") {
    set.descriptionHtml = sanitizeHtml(f.descriptionHtml);
    set.description = stripHtml(set.descriptionHtml as string);
  }
  return set;
}

const corto = (v: unknown) => {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 140 ? `${s.slice(0, 140)}…` : s;
};

async function main(): Promise<void> {
  const nombre = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const apply = process.argv.includes("--apply");
  if (!nombre) {
    console.error("Uso: npm run fichas -- <lote> [--apply]");
    process.exit(1);
  }
  const archivo = path.join(process.cwd(), "data", "fichas", `${nombre.replace(/\.json$/, "")}.json`);
  const lote = JSON.parse(readFileSync(archivo, "utf8")) as Lote;

  const errores = lote.productos.flatMap((f) => validarFicha(f).map((e) => `${f.slug}: ${e}`));
  if (errores.length) {
    console.error(`[fichas] el lote tiene problemas, no se carga nada:\n  ${errores.join("\n  ")}`);
    process.exit(1);
  }

  const { db, pool } = await import("@/db");
  const cambios: { id: number; slug: string; set: Record<string, unknown> }[] = [];
  const faltantes: string[] = [];
  let salteadas = 0;

  for (const f of lote.productos) {
    // Algunos slugs heredados tienen caracteres codificados ("55%e2%80%b3").
    const candidatos = [...new Set([f.slug, safeDecode(f.slug)])];
    let fila: (typeof products.$inferSelect) | undefined;
    for (const slug of candidatos) {
      [fila] = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
      if (fila) break;
    }
    if (!fila) {
      faltantes.push(f.slug);
      continue;
    }
    if (lote.soloSinCurar && fila.seoTitle) {
      salteadas += 1;
      continue;
    }
    const set = valores(f);
    console.log(`\n═══ ${fila.slug} ═══`);
    for (const [campo, nuevo] of Object.entries(set)) {
      const actual = (fila as Record<string, unknown>)[campo];
      if (JSON.stringify(actual ?? null) === JSON.stringify(nuevo)) continue;
      console.log(`  ${campo}\n    antes:   ${corto(actual ?? "(vacío)")}\n    después: ${corto(nuevo)}`);
    }
    for (const nota of f.revisar ?? []) console.log(`  ⚠ revisar: ${nota}`);
    cambios.push({ id: fila.id, slug: fila.slug, set });
  }

  if (salteadas) console.log(`\n[fichas] ${salteadas} fichas salteadas porque ya estaban curadas.`);
  if (faltantes.length) console.log(`\n[fichas] no están en la base: ${faltantes.join(", ")}`);

  if (!apply) {
    console.log(`\n[fichas] modo prueba: ${cambios.length} fichas listas, no se escribió nada. Para cargar: npm run fichas -- ${nombre} --apply`);
    await pool.end();
    return;
  }

  await db.transaction(async (tx) => {
    for (const c of cambios) {
      await tx.update(products).set({ ...c.set, updatedAt: sql`now()` }).where(eq(products.id, c.id));
    }
  });
  console.log(`\n[fichas] cargadas ${cambios.length} fichas del ${lote.lote}. La tienda las muestra en hasta 5 minutos (caché).`);
  await pool.end();
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

if (process.argv[1]?.endsWith("fichas.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
