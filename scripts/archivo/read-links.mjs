/**
 * Lista los links con href y texto de la página.
 *
 * El carrito de WooCommerce no expone un botón "vaciar" como <button>: es un
 * <a> con un nonce de seguridad, y hay que encontrarlo por href para poder
 * vaciar la sesión de prueba.
 *
 * Uso: node scripts/read-links.mjs <pageId> [url]
 */
import { execFileSync } from "node:child_process";

const [page, url] = process.argv.slice(2);
if (!page) {
  console.error("uso: node scripts/read-links.mjs <pageId> [url]");
  process.exit(1);
}

const orca = (a) => execFileSync("orca", a, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
if (url) orca(["goto", "--url", url, "--page", page, "--json"]);

const EXPR = `(() => {
  const links = [...document.querySelectorAll("a")].map((a) => ({
    texto: (a.innerText || a.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 60),
    href: (a.getAttribute("href") || "").slice(0, 160),
  })).filter((l) => /remove|empty|carrito|cart|remove_item|empty_cart/i.test(l.href + " " + l.texto));
  return JSON.stringify({ url: location.href, links: links.slice(0, 25) }, null, 1);
})()`;

const raw = JSON.parse(orca(["eval", "--page", page, "--expression", EXPR, "--json"]));
console.log(raw.result.result);
