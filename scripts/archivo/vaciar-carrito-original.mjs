/**
 * Vacía el carrito del sitio original. Los ítems se quitan con links
 * `remove_item`, que son <a> con nonce y no botones.
 *
 * El cálculo de envío de WooCommerce se cachea en la sesión: para medir cuánto
 * cuesta enviar UN producto hay que dejar el carrito con uno solo, si no el
 * número que se lee es el del pedido anterior.
 *
 * Uso: node scripts/vaciar-carrito-original.mjs <pageId>
 */
import { execFileSync } from "node:child_process";

const [page] = process.argv.slice(2);
if (!page) {
  console.error("uso: node scripts/vaciar-carrito-original.mjs <pageId>");
  process.exit(1);
}

const orca = (a) => execFileSync("orca", a, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const CARRITO = "https://www.cordobadigital.net/carrito/";

const QUITAR = `(() => {
  const href = [...document.querySelectorAll("a")].map((a) => a.getAttribute("href") || "").find((h) => h.includes("remove_item="));
  return href || "";
})()`;

for (let intento = 0; intento < 8; intento += 1) {
  orca(["goto", "--url", CARRITO, "--page", page, "--json"]);
  await dormir(3500);
  const raw = JSON.parse(orca(["eval", "--page", page, "--expression", QUITAR, "--json"]));
  const href = JSON.parse(raw.result.result);
  if (!href) {
    console.log(`carrito vacío (${intento} quitados)`);
    process.exit(0);
  }
  orca(["goto", "--url", href, "--page", page, "--json"]);
  await dormir(3500);
}
console.log("no se pudo vaciar el carrito");
