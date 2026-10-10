/**
 * Extrae los medios de pago y las opciones de envío de una página de checkout.
 *
 * Por qué existe: el checkout de WooCommerce se arma con JavaScript, así que
 * `fetch` sobre el HTML no devuelve ni los radios de pago ni los radios de envío.
 * Hay que leer el DOM renderizado. Se usa contra el sitio original para copiar
 * los valores reales y no inventarlos.
 *
 * Uso: node scripts/read-checkout.mjs <pageId> [url]
 */
import { execFileSync } from "node:child_process";

const [page, url] = process.argv.slice(2);
if (!page) {
  console.error("uso: node scripts/read-checkout.mjs <pageId> [url]");
  process.exit(1);
}

const orca = (a) => execFileSync("orca", a, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
if (url) orca(["goto", "--url", url, "--page", page, "--json"]);

const EXPR = `(() => {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
  };
  const txt = (el) => (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim();

  // Un grupo de radios = todas las entradas que comparten el mismo name.
  const grupos = {};
  for (const el of document.querySelectorAll('input[type="radio"], input[type="checkbox"]')) {
    if (!vis(el)) continue;
    const name = el.name || "(sin name)";
    (grupos[name] ||= []).push({
      valor: el.value,
      marcado: el.checked,
      etiqueta: txt(el.closest("label") || el.parentElement).slice(0, 110),
    });
  }

  const secciones = [...document.querySelectorAll("h2, h3, legend, .wc-block-components-title")]
    .filter(vis)
    .map(txt)
    .filter((t) => t.length > 2 && t.length < 70);

  return JSON.stringify(
    {
      url: location.href,
      titulo: document.title,
      grupos,
      secciones: [...new Set(secciones)].slice(0, 30),
    },
    null,
    1,
  );
})()`;

const raw = JSON.parse(orca(["eval", "--page", page, "--expression", EXPR, "--json"]));
console.log(raw.result.result);
