/**
 * Muestra por qué la guarda de seguridad de la migración de guías se dispara.
 *
 * Antes de abortar, el script mira cinco señales en el HTML ya saneado. Este
 * script las corre una por una sobre el artículo real y dice cuál es, para no
 * tener que adivinar.
 *
 * Uso: node scripts/diagnostico-guia.mjs <slug>
 */
import { sanearGuia, separarPreambulo } from "../lib/guia-html";

const slug = process.argv[2] ?? "como-elegir-tu-proxima-impresora";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const SENALES: [string, RegExp][] = [
  ["<script", /<script/i],
  ["<style", /<style/i],
  ["javascript:", /javascript:/i],
  ["atributo on*", /\son\w+\s*=/i],
  ["atributo style", /style\s*=/i],
  ["URL de WooCommerce", /categoria-producto/i],
];

async function main() {
  const res = await fetch(
    `https://www.cordobadigital.net/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&_fields=content,title`,
    { headers: { "user-agent": UA }, signal: AbortSignal.timeout(60_000) },
  );
  const post = (await res.json())[0];
  if (!post) {
    console.error(`no existe: ${slug}`);
    process.exit(1);
  }

  const cuerpo = separarPreambulo(sanearGuia(post.content.rendered)).cuerpo;

  console.log(`\n${slug}\n`);
  let malas = 0;
  for (const [nombre, patron] of SENALES) {
    const m = patron.exec(cuerpo);
    if (!m) {
      console.log(`  OK    ${nombre}`);
      continue;
    }
    malas += 1;
    const desde = Math.max(0, m.index - 90);
    console.log(`  FALLA ${nombre}\n        ...${cuerpo.slice(desde, m.index + 110).replace(/\n/g, " | ")}...`);
  }
  console.log(`\n${malas} señal(es) que disparan el aborto\n`);
}

main();
