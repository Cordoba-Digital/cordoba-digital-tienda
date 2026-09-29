/**
 * Chequea que las afirmaciones del índice `/guias` estén respaldadas por el
 * contenido real de los artículos.
 *
 * Hay dos cosas distintas y este script las separa, porque antes las mezclaba:
 *
 *   1. Lo que el índice AFIRMA tiene que estar respaldado por los artículos.
 *      El texto del índice lo escribimos nosotros, no viene de WordPress, así
 *      que puede mentir sin que nadie se entere.
 *
 *   2. Lo que el índice NO debe prometer. Y acá el sujeto es el índice, no los
 *      artículos: que los artículos hablen de "stock local en Córdoba" como
 *      criterio de compra no nos autoriza a prometer disponibilidad, porque
 *      nuestro stock es un aproximado de la migración y no es inventario real.
 *
 * Sirvió para encontrar una: la primera versión del índice decía "con los precios
 * y la disponibilidad de Córdoba", y solo 1 de 5 guías cita precios en pesos.
 *
 * Uso: npm run verificar:claims-guias -- <baseUrl del sitio>
 */
import { aTextoPlano, contarPalabras, sanearGuia, separarPreambulo } from "./lib/guia-html";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const BASE = process.argv[2] ?? "http://localhost:3000";

const SLUGS = [
  "como-elegir-tu-proxima-impresora",
  "guia-completa-xiaomi-argentina",
  "guia-notebooks-argentina",
  "guia-macbook-argentina",
  "guia-de-monopatines-electricos-en-argentina-2026",
];

/** Afirmaciones del índice, con la evidencia que las tiene que sostener. */
const AFIRMACIONES: { frase: string; minimo: number; patron: RegExp }[] = [
  {
    frase: "'mercado argentino'",
    minimo: 5,
    patron: /Argentina/i,
  },
  {
    frase: "'qué mirar antes de comprar'",
    minimo: 5,
    patron: /elegir|elecci[oó]n|gu[ií]a de (selecci[oó]n|compra)|antes de comprar/i,
  },
  {
    frase: "'en qué se diferencian las opciones'",
    minimo: 5,
    patron: /comparativ|\bvs\.?\b|diferencia|alternativ|pros y contras|ventajas y desventajas/i,
  },
  {
    frase: "'cuál conviene para cada uso'",
    minimo: 4,
    patron: /perfil|para (estudiantes|profesionales|programadores|creadores|oficinas)|seg[uú]n (el|tu) (uso|necesidad)|uso (personal|profesional)/i,
  },
];

/**
 * Promesas que el índice no puede hacer. Se buscan en el TEXTO DEL ÍNDICE, no en
 * los artículos: los artículos pueden hablar de stock o de envíos como criterio
 * de compra sin que eso autorice a la tienda a prometerlo.
 */
const PROMESAS_SIN_RESPALDO: { frase: string; motivo: string; patron: RegExp }[] = [
  {
    frase: "precios",
    motivo: "solo 1 de las 5 guías cita precios en pesos, y hay precios reales en la base que pueden cambiar",
    patron: /\bprecios?\b|\$\s?\d|\bpesos\b/i,
  },
  {
    frase: "disponibilidad o stock",
    motivo: "el stock de la base es un aproximado de la migración, no inventario real",
    patron: /disponibilidad|\bstock\b|inmediata/i,
  },
  {
    frase: "plazos de entrega propios",
    motivo: "los plazos de envío los calcula Andreani y no son un dato de la tienda",
    patron: /entregamos|llega (hoy|mañana)|en \d+ (hs|horas|d[ií]as)/i,
  },
  {
    frase: "garantía de N meses",
    motivo: "la garantía legal es de 6 meses (Ley 24.240); prometer otra cosa sería falso",
    patron: /\d+\s*mes(es)? de garant[ií]a/i,
  },
  {
    frase: "descuentos o promociones",
    motivo: "no hay descuentos en el sitio original y los cupones están inactivos",
    patron: /descuento|\b\d+\s*% OFF|15%/i,
  },
  {
    frase: "cuotas sin interés",
    motivo: "el checkout original no tiene tarjeta; las cuotas vienen de Mercado Pago, que aún no está integrado",
    patron: /cuotas? sin inter[eé]s|financiaci[oó]n/i,
  },
];

async function main() {
  // 1. Los artículos.
  const textos = new Map<string, string>();
  for (const slug of SLUGS) {
    const res = await fetch(
      `https://www.cordobadigital.net/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&_fields=content`,
      { headers: { "user-agent": UA }, signal: AbortSignal.timeout(60_000) },
    );
    const post = (await res.json())[0];
    if (!post) {
      console.error(`[claims] el artículo ${slug} ya no está en WordPress`);
      process.exit(1);
    }
    textos.set(slug, aTextoPlano(separarPreambulo(sanearGuia(post.content.rendered)).cuerpo));
  }

  // 2. El índice, ya renderizado.
  const res = await fetch(`${BASE}/guias`, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(60_000) });
  if (!res.ok) {
    console.error(`[claims] no se pudo leer ${BASE}/guias (HTTP ${res.status}). Levantá el sitio o pasá otra URL.`);
    process.exit(1);
  }
  const html = await res.text();
  const indice = aTextoPlano(
    (html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? html)
      .replace(/<script[\s\S]*?<\/script>/g, " ")
      .replace(/<style[\s\S]*?<\/style>/g, " "),
  );

  let fallas = 0;

  console.log(`\nlo que el índice AFIRMA, y si los artículos lo sostienen (${BASE}/guias) `.padEnd(74, "─"));
  for (const { frase, minimo, patron } of AFIRMACIONES) {
    const n = [...textos.values()].filter((t) => patron.test(t)).length;
    const ok = n >= minimo;
    if (!ok) fallas += 1;
    console.log(`  ${ok ? "OK   " : "FALLA"} ${String(n).padStart(2)}/5  ${frase}`);
  }

  console.log("\nlo que el índice NO puede prometer ".padEnd(74, "─"));
  for (const { frase, motivo, patron } of PROMESAS_SIN_RESPALDO) {
    const m = patron.exec(indice);
    if (m) fallas += 1;
    console.log(`  ${m ? "FALLA" : "OK   "} no promete ${frase}`);
    if (m) {
      const desde = Math.max(0, m.index - 70);
      console.log(`         “…${indice.slice(desde, m.index + 70)}…”`);
      console.log(`         ${motivo}`);
    }
  }

  console.log("\nvolumen de los artículos ".padEnd(74, "─"));
  let total = 0;
  for (const [slug, texto] of textos) {
    const n = contarPalabras(texto);
    total += n;
    console.log(`  ${String(n).padStart(5)} palabras  ${slug}`);
  }
  console.log(`  ${String(total).padStart(5)} palabras  en total`);

  console.log(`\n[claims] ${fallas === 0 ? "todo sostenido" : `${fallas} problema(s)`}\n`);
  process.exit(fallas ? 1 : 0);
}

main();
