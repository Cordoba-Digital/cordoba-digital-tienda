/**
 * Lee los precios que el navegador está mostrando de verdad.
 *
 * Por qué hace falta: el HTML servido de una ruta de producto no siempre trae
 * el precio ya formateado (parte del contenido se arma en el cliente), así que
 * buscar "$" en el `fetch` puede dar cero resultados aunque la pantalla esté
 * correcta. Solo el DOM renderizado dice la verdad.
 *
 * Uso: node scripts/read-prices.mjs <pageId> <url>
 */
import { execFileSync } from "node:child_process";

const [page, url] = process.argv.slice(2);
if (!page) {
  console.error("uso: node scripts/read-prices.mjs <pageId> <url>");
  process.exit(1);
}

const orca = (a) => execFileSync("orca", a, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
if (url) orca(["goto", "--url", url, "--page", page, "--json"]);

const EXPR = `(() => {
  const textos = [...document.querySelectorAll("*")]
    .filter((el) => el.children.length === 0)
    .map((el) => (el.textContent || "").trim())
    .filter((t) => /\\$\\s?[\\d][\\d.]{2,}/.test(t));
  const unicos = [...new Set(textos)];
  return JSON.stringify(
    {
      precioPrincipal: unicos.slice(0, 8),
      total: unicos.length,
      titulo: document.title,
    },
    null,
    1,
  );
})()`;

const raw = JSON.parse(orca(["eval", "--page", page, "--expression", EXPR, "--json"]));
console.log(raw.result.result);
