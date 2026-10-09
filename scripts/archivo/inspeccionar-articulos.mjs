/**
 * Inventaría qué etiquetas y atributos usan los artículos del blog antes de
 * migrarlos.
 *
 * El contenido viene de WordPress como HTML suelto. Si se guarda en la base y se
 * pinta con `dangerouslySetInnerHTML`, hay que saber exactamente qué etiquetas
 * hay para armar la lista blanca. Este script las cuenta.
 *
 * Uso: node scripts/inspeccionar-articulos.mjs
 */
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const BASE = "https://www.cordobadigital.net";

const SLUGS = [
  "como-elegir-tu-proxima-impresora",
  "guia-completa-xiaomi-argentina",
  "guia-notebooks-argentina",
  "guia-macbook-argentina",
  "guia-de-monopatines-electricos-en-argentina-2026",
];

const get = async (u) => {
  const res = await fetch(u, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${u}`);
  return res.json();
};

const etiquetas = new Map();
const atributos = new Map();
const hrefs = new Set();

for (const slug of SLUGS) {
  const posts = await get(`${BASE}/wp-json/wp/v2/posts?slug=${slug}&_fields=id,slug,title,excerpt,content,date,modified`);
  const post = posts[0];
  if (!post) {
    console.log(`\n${slug}: NO EXISTE`);
    continue;
  }
  const html = post.content.rendered;

  for (const m of html.matchAll(/<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g)) {
    const tag = m[1].toLowerCase();
    etiquetas.set(tag, (etiquetas.get(tag) ?? 0) + 1);
    for (const a of m[2].matchAll(/([a-zA-Z-]+)\s*=/g)) {
      const attr = `${tag}.${a[1].toLowerCase()}`;
      atributos.set(attr, (atributos.get(attr) ?? 0) + 1);
    }
  }
  for (const m of html.matchAll(/href="([^"]+)"/g)) hrefs.add(m[1]);

  const texto = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const h2 = (html.match(/<h2/gi) ?? []).length;
  const h3 = (html.match(/<h3/gi) ?? []).length;
  console.log(
    `${slug}\n  ${post.title.rendered.replace(/<[^>]+>/g, "")}\n` +
      `  palabras: ${texto.split(" ").length}   h2: ${h2}   h3: ${h3}   caracteres: ${html.length}\n` +
      `  excerpt: ${(post.excerpt?.rendered ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 90)}\n`,
  );
}

console.log("── etiquetas usadas ".padEnd(30, "─"));
[...etiquetas.entries()].sort((a, b) => b[1] - a[1]).forEach(([t, n]) => console.log(`  ${String(n).padStart(6)}  <${t}>`));

console.log("── atributos usados ".padEnd(30, "─"));
[...atributos.entries()].sort((a, b) => b[1] - a[1]).forEach(([a, n]) => console.log(`  ${String(n).padStart(6)}  ${a}`));

console.log("── destinos de los enlaces ".padEnd(30, "─"));
[...hrefs].sort().forEach((h) => console.log(`  ${h}`));
