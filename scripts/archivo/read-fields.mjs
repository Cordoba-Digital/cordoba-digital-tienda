/**
 * Lista los campos de formulario de la página, con id, name y valor actual.
 *
 * Para leer el checkout de WooCommerce hay que conocer los ids reales de los
 * campos: el checkout clásico usa `shipping_postcode` / `billing_postcode`, pero
 * según el tema y los plugins cambian de nombre. Es lo que falló al intentar
 * medir los costos de envío por CP.
 *
 * Uso: node scripts/read-fields.mjs <pageId> [url]
 */
import { execFileSync } from "node:child_process";

const [page, url] = process.argv.slice(2);
if (!page) {
  console.error("uso: node scripts/read-fields.mjs <pageId> [url]");
  process.exit(1);
}

const orca = (a) => execFileSync("orca", a, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
if (url) orca(["goto", "--url", url, "--page", page, "--json"]);

const EXPR = `(() => {
  const campos = [...document.querySelectorAll("input, select, textarea")]
    .filter((el) => el.type !== "hidden" && el.type !== "radio" && el.type !== "checkbox")
    .map((el) => ({
      tag: el.tagName.toLowerCase(),
      type: el.type || "",
      id: el.id || "",
      name: el.name || "",
      valor: (el.value || "").slice(0, 40),
      visible: el.getBoundingClientRect().width > 0,
    }));
  return JSON.stringify({ url: location.href, campos }, null, 1);
})()`;

const raw = JSON.parse(orca(["eval", "--page", page, "--expression", EXPR, "--json"]));
console.log(raw.result.result);
