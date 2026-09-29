/**
 * Verifica que una guía de compra se vea bien de verdad en el navegador.
 *
 * Lo que mira, y por qué:
 *   - que la columna "Guía de compras" esté en el pie y con los 5 enlaces;
 *   - que el artículo haya perdido el CSS que traía pegado (si el `<style>` del
 *     artículo llegara al navegador, la página entera se deformaría);
 *   - que no haya desborde horizontal (las tablas de comparación son anchas);
 *   - que los encabezados y las tablas del artículo estén presentes.
 *
 * Uso: node scripts/verificar-guia.mjs <baseUrl> <slug>
 */
import { execFileSync } from "node:child_process";

const base = process.argv[2] || "http://localhost:3000";
const slug = process.argv[3] || "como-elegir-tu-proxima-impresora";

const orca = (a) => execFileSync("orca", a, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const EXPR = `(() => {
  const doc = document.documentElement;
  // Estilos que el artículo traía pegados y NO deben haber llegado: si alguno
  // está, es que el saneador no hizo su trabajo.
  const cssViejo = [...document.querySelectorAll("style")]
    .map((s) => s.textContent || "")
    .filter((t) => /categoria-producto|wp-content|CordobaDigital\\.net\\/?\\s*\\*/i.test(t));

  const pie = document.querySelector("footer");
  const columnaGuias = pie
    ? [...pie.querySelectorAll("h3")].find((h) => /gu[ií]a de compras/i.test(h.textContent || ""))
    : null;
  // El título de la columna también es un <a> (abre /guias), así que se cuentan
  // solo los enlaces de la lista, que son las guías.
  const listaGuias = columnaGuias ? columnaGuias.parentElement.querySelector("ul") : null;
  const enlacesGuia = listaGuias
    ? [...listaGuias.querySelectorAll("a")].map((a) => ({
        texto: (a.textContent || "").trim(),
        href: a.getAttribute("href"),
      }))
    : [];

  const h1 = document.querySelector("h1");
  const articulo = document.querySelector(".prose-cd");
  const tablas = articulo ? [...articulo.querySelectorAll("table")] : [];

  return JSON.stringify({
    url: location.pathname,
    titulo: document.title,
    descripcion: document.querySelector('meta[name="description"]')?.getAttribute("content") || "",
    h1: h1 ? (h1.textContent || "").trim() : null,
    cssDelArticulo: cssViejo.length,
    columnaGuias: Boolean(columnaGuias),
    enlacesGuia,
    palabras: articulo ? (articulo.innerText || "").trim().split(/\\s+/).length : 0,
    h2: articulo ? articulo.querySelectorAll("h2").length : 0,
    tablas: tablas.length,
    tablasDesbordan: tablas.filter((t) => t.getBoundingClientRect().width > doc.clientWidth + 1).length,
    docScrollW: doc.scrollWidth,
    viewport: innerWidth,
    desborda: doc.scrollWidth > innerWidth + 1,
  });
})()`;

// El id de la página viene anidado en `result.browserPageId`, no en la raíz.
const tab = JSON.parse(orca(["tab", "create", "--url", `${base}/${slug}`, "--json"]));
const pageId = tab.result?.browserPageId ?? tab.browserPageId;
if (!pageId) {
  console.error("no se pudo abrir la pestaña:", JSON.stringify(tab).slice(0, 200));
  process.exit(1);
}
await dormir(5000);
const raw = JSON.parse(orca(["eval", "--page", pageId, "--expression", EXPR, "--json"]));
const r = JSON.parse(raw.result.result);

let fallas = 0;
const chequeo = (nombre, ok, detalle) => {
  if (!ok) fallas += 1;
  console.log(`  ${ok ? "OK   " : "FALLA"} ${nombre}${detalle ? ` · ${detalle}` : ""}`);
};

console.log(`\nguía ${r.url}\n`);
console.log(`  título: ${r.titulo}`);
console.log(`  h1: ${r.h1}`);
console.log(`  descripción: ${r.descripcion.slice(0, 110)}\n`);

chequeo("el artículo trae contenido", r.palabras > 800, `${r.palabras} palabras`);
chequeo("tiene encabezados h2", r.h2 >= 5, `${r.h2} h2`);
chequeo("tiene tablas de comparación", r.tablas >= 1, `${r.tablas} tablas`);
chequeo("el CSS del artículo NO llegó al navegador", r.cssDelArticulo === 0, `${r.cssDelArticulo} estilos`);
chequeo("el pie tiene la columna 'Guía de compras'", r.columnaGuias);
chequeo("el pie enlaza las 5 guías", r.enlacesGuia.length === 5, `${r.enlacesGuia.length} enlaces`);
chequeo(
  "los enlaces del pie apuntan a rutas internas",
  r.enlacesGuia.every((l) => l.href?.startsWith("/") && !l.href.includes("cordobadigital.net/categoria-producto")),
  r.enlacesGuia.map((l) => l.href).join(" "),
);
chequeo("ninguna tabla desborda la página", r.tablasDesbordan === 0, `${r.tablasDesbordan} tablas`);
chequeo("no hay desborde horizontal", !r.desborda, `doc ${r.docScrollW} vs viewport ${r.viewport}`);

console.log(`\n[guía] ${fallas === 0 ? "todo OK" : `${fallas} falla(s)`}\n`);
process.exit(fallas ? 1 : 0);
