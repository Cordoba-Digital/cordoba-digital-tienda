/**
 * Lista los botones y links accionables visibles de una página.
 *
 * Sirve para recorrer el flujo de compra del sitio original: primero hay que
 * saber qué botón hay en pantalla ("Comprar", "Ir a finalizar la compra", etc.)
 * antes de poder pulsarlo. Se lee el DOM porque el HTML servido no siempre trae
 * lo que se dibuja en el cliente.
 *
 * Uso: node scripts/read-buttons.mjs <pageId> [url]
 */
import { execFileSync } from "node:child_process";

const [page, url] = process.argv.slice(2);
if (!page) {
  console.error("uso: node scripts/read-buttons.mjs <pageId> [url]");
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
  const botones = [...document.querySelectorAll("button, a.btn, .button, input[type=submit]")]
    .filter(vis)
    .map((b) => txt(b))
    .filter(Boolean);
  return JSON.stringify(
    { url: location.href, titulo: document.title, botones: [...new Set(botones)].slice(0, 30) },
    null,
    1,
  );
})()`;

const raw = JSON.parse(orca(["eval", "--page", page, "--expression", EXPR, "--json"]));
console.log(raw.result.result);
