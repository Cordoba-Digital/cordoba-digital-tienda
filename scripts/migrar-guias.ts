/**
 * Migra las guías de compra del blog de WordPress a la base de la tienda.
 *
 * Son los cinco artículos que el pie del sitio original enlaza bajo "Guía de
 * compras". Se migran con el MISMO slug, o sea la misma URL, para que el SEO que
 * ya tienen no se pierda cuando el cliente apague el hosting viejo.
 *
 * El HTML pasa por `scripts/lib/guia-html.mjs`, que:
 *   - saca el documento HTML completo que cada artículo tiene pegado adentro
 *     del campo de contenido (con su `<style>` y su `<meta charset>`);
 *   - deja solo una lista blanca de etiquetas, sin atributos salvo `href`;
 *   - reescribe los enlaces de categoría de WooCommerce a las rutas de la tienda.
 *
 * Uso:
 *   npm run migrar:guias -- --dry-run   # solo informa, no escribe
 *   npm run migrar:guias               # escribe (o actualiza)
 */
import "dotenv/config";

import { eq, sql } from "drizzle-orm";

import { guides } from "@/db/schema";
import { contarPalabras, sanearGuia, separarPreambulo } from "./lib/guia-html";

const BASE = (process.env.WC_STORE_URL ?? "https://www.cordobadigital.net").replace(/\/+$/, "");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/**
 * Los cinco, en el mismo orden en que los lista el pie del sitio original.
 * `footerOrder` arranca en 1 y ese número es el que ordena la columna.
 */
const GUIAS = [
  { slug: "como-elegir-tu-proxima-impresora", order: 1 },
  { slug: "guia-completa-xiaomi-argentina", order: 2 },
  { slug: "guia-notebooks-argentina", order: 3 },
  { slug: "guia-macbook-argentina", order: 4 },
  { slug: "guia-de-monopatines-electricos-en-argentina-2026", order: 5 },
];

const dryRun = !process.argv.includes("--apply");

type WpPost = {
  id: number;
  slug: string;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
  date: string;
  modified: string;
};

async function fetchPost(slug: string): Promise<WpPost | null> {
  const res = await fetch(
    `${BASE}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&_fields=id,slug,title,excerpt,content,date,modified`,
    { headers: { "user-agent": UA }, signal: AbortSignal.timeout(60_000) },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status} al pedir ${slug}`);
  const items = (await res.json()) as WpPost[];
  return items[0] ?? null;
}

/** Quita el HTML del título y del resumen: acá van como texto plano. */
function aTexto(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number.parseInt(d, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/[ \t]+/g, " ")
    .trim();
}

async function main() {
  const { db } = await import("@/db");

  console.log(`[guias] ${dryRun ? "DRY RUN · no se escribe nada" : "ESCRIBIENDO"} · ${BASE}\n`);

  const existentes = await db
    .select({ slug: guides.slug, words: guides.wordCount, updated: guides.updatedAt })
    .from(guides);
  const porSlug = new Map(existentes.map((g) => [g.slug, g]));

  let creados = 0;
  let actualizados = 0;
  let sinCambio = 0;
  const faltantes: string[] = [];

  for (const guia of GUIAS) {
    const post = await fetchPost(guia.slug);
    if (!post) {
      console.log(`  [falta] ${guia.slug}: no está en WordPress`);
      faltantes.push(guia.slug);
      continue;
    }

    const saneado = sanearGuia(post.content.rendered);
    const { meta, cuerpo } = separarPreambulo(saneado);
    const title = aTexto(post.title.rendered);
    // El subtítulo y el resumen salen del preámbulo que escribieron los autores,
    // no del excerpt de WordPress: el excerpt es el comienzo entero del artículo
    // y no sirve como descripción.
    const subtitle = meta.subtitulo;
    const description = (meta.descripcion || aTexto(post.excerpt.rendered)).slice(0, 300);
    const words = contarPalabras(cuerpo);

    // Guarda de seguridad: si el saneador dejara pasar algo peligroso, se corta
    // acá. Ningún artículo debería disparar ninguna de estas señales.
    const peligroso =
      /<script/i.test(cuerpo) ||
      /<style/i.test(cuerpo) ||
      /javascript:/i.test(cuerpo) ||
      /\son\w+\s*=/i.test(cuerpo) ||
      /style\s*=/i.test(cuerpo) ||
      /categoria-producto/i.test(cuerpo);

    if (peligroso) {
      console.error(`  [ABORTA] ${guia.slug}: el HTML saneado todavía tiene algo ejecutable o una URL vieja.`);
      process.exit(1);
    }

    const previa = porSlug.get(guia.slug);
    if (previa && previa.words === words) {
      sinCambio += 1;
      console.log(`  = ${guia.slug}  ${words} palabras (sin cambios)`);
      continue;
    }

    if (!dryRun) {
      const valores = {
        slug: guia.slug,
        title,
        subtitle,
        description,
        body: cuerpo,
        wordCount: words,
        footerOrder: guia.order,
        meta,
        publishedAt: new Date(post.date),
        updatedAt: new Date(post.modified),
      };
      if (previa) {
        await db.update(guides).set(valores).where(eq(guides.slug, guia.slug));
        actualizados += 1;
      } else {
        await db.insert(guides).values(valores);
        creados += 1;
      }
    }

    const accion = dryRun ? "a escribir" : previa ? "actualizada" : "creada";
    console.log(
      `  + ${guia.slug}\n` +
        `      título    : ${title}\n` +
        `      subtítulo : ${subtitle.slice(0, 70)}\n` +
        `      resumen   : ${description.slice(0, 70)}\n` +
        `      meta      : ${[meta.etiqueta, meta.actualizacion, meta.cobertura, meta.categoria].filter(Boolean).join(" · ") || "—"}\n` +
        `      palabras  : ${words}   h2: ${(cuerpo.match(/<h2/g) ?? []).length}   tablas: ${(cuerpo.match(/<table/g) ?? []).length}   ${accion}`,
    );
  }

  // Cualquier guía en la base que ya no esté en la lista de WordPress.
  const huerfanas = existentes.filter((g) => !GUIAS.some((x) => x.slug === g.slug));
  if (huerfanas.length) {
    console.log(`\n  en la base pero ya no están en la lista: ${huerfanas.map((g) => g.slug).join(", ")}`);
    console.log("  (no se borran: se avisa para que la decisión sea del cliente)");
  }

  const total = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM guides`);
  console.log(
    `\n[guias] ${creados} creadas, ${actualizados} actualizadas, ${sinCambio} sin cambios` +
      (dryRun ? " (dry run)" : "") +
      `  ·  total en la base: ${total.rows[0]?.n ?? 0}`,
  );
  if (faltantes.length) {
    console.error(`[guias] FALTAN en WordPress: ${faltantes.join(", ")}`);
    process.exit(1);
  }
  if (dryRun) console.log("[guias] dry run: no se escribió nada. Usá --apply para escribir.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[guias] falló:", error);
    process.exit(1);
  });
