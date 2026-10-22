/**
 * Guías y notas del blog migradas del WordPress: las del pie van primero y en
 * su orden, las notas después (la más nueva primero), y una nota con emoji en
 * la dirección se encuentra con el slug crudo o decodificado.
 *
 * Uso: npm run test:api (necesita Postgres local migrado en DATABASE_URL)
 */
import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";

import { sql } from "drizzle-orm";

const { db, pool, schema } = await import("./db.mts");
const { getGuideBySlug, getGuides } = await import("../../src/lib/queries");

const EMOJI = "%f0%9f%93%b1-que-celular-conviene-comprar-en-argentina-en-2026";

async function guia(slug: string, footerOrder: number, publishedAt: string) {
  await db.insert(schema.guides).values({
    slug,
    title: `Título de ${slug}`,
    body: "<p>Texto.</p>",
    footerOrder,
    publishedAt: new Date(publishedAt),
  });
}

beforeEach(async () => {
  await db.execute(sql`truncate table guides restart identity`);
});
after(() => pool.end());

test("las guías del pie van primero en su orden y después las notas, de la más nueva a la más vieja", async () => {
  await guia("nota-vieja", 0, "2025-03-01");
  await guia("guia-macbook-argentina", 2, "2025-01-01");
  await guia(EMOJI, 0, "2026-02-01");
  await guia("como-elegir-tu-proxima-impresora", 1, "2024-06-01");

  const lista = await getGuides();
  assert.deepEqual(
    lista.map((g) => [g.slug, g.footerOrder]),
    [
      ["como-elegir-tu-proxima-impresora", 1],
      ["guia-macbook-argentina", 2],
      [EMOJI, 0],
      ["nota-vieja", 0],
    ],
  );
});

test("la nota con emoji se encuentra con el slug crudo, decodificado o en mayúsculas", async () => {
  await guia(EMOJI, 0, "2026-02-01");
  const mayusculas = EMOJI.replace(/%[0-9a-f]{2}/g, (m) => m.toUpperCase());
  for (const slug of [EMOJI, decodeURIComponent(EMOJI), mayusculas]) {
    assert.equal((await getGuideBySlug(slug))?.slug, EMOJI, slug);
  }
  assert.equal(await getGuideBySlug("no-existe"), null);
});
