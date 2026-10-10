/**
 * Muestra en qué contexto aparece cada palabra que el índice no debería prometer.
 *
 * Sirve para ajustar los patrones de `verificar-claims-guias`: un patrón
 * demasiado grueso marca falla por coincidencias que no son lo que dice el
 * índice. Por ejemplo, "envíos a" aparece en los cinco artículos y no es lo
 * mismo que prometer disponibilidad de stock.
 *
 * Uso: node scripts/ver-contexto-claims.ts <patrón en regex>
 */
import { aTextoPlano, sanearGuia, separarPreambulo } from "../lib/guia-html";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const SLUGS = [
  "como-elegir-tu-proxima-impresora",
  "guia-completa-xiaomi-argentina",
  "guia-notebooks-argentina",
  "guia-macbook-argentina",
  "guia-de-monopatines-electricos-en-argentina-2026",
];

const patron = new RegExp(process.argv[2] ?? "disponib", "i");

async function main() {
  for (const slug of SLUGS) {
    const res = await fetch(
      `https://www.cordobadigital.net/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&_fields=content`,
      { headers: { "user-agent": UA }, signal: AbortSignal.timeout(60_000) },
    );
    const post = (await res.json())[0];
    if (!post) continue;
    const texto = aTextoPlano(separarPreambulo(sanearGuia(post.content.rendered)).cuerpo);

    const encontrados = [...texto.matchAll(new RegExp(patron.source, "gi"))];
    console.log(`\n${slug}  (${encontrados.length} coincidencias)`);
    for (const m of encontrados.slice(0, 6)) {
      const desde = Math.max(0, m.index - 55);
      console.log(`   …${texto.slice(desde, m.index + 65)}…`);
    }
  }
}

main();
