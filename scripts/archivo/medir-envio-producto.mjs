/**
 * Mide la tarifa de envío del sitio original para un producto concreto.
 *
 * El checkout de WooCommerce no publica una tabla: el costo sale de un cálculo
 * por peso, no por zona (verificado: CABA, Córdoba Capital y Río Gallegos
 * devuelven lo mismo). Entonces la única forma de armar la fórmula es medir un
 * producto, medir otro de peso muy distinto y resolver.
 *
 * Uso: node scripts/medir-envio-producto.mjs <pageId> <slug del producto>
 */
import { execFileSync } from "node:child_process";

const [page, slug] = process.argv.slice(2);
if (!page || !slug) {
  console.error("uso: node scripts/medir-envio-producto.mjs <pageId> <slug>");
  process.exit(1);
}

const orca = (a) => execFileSync("orca", a, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = "https://www.cordobadigital.net";

/** Vacía el carrito para medir un solo producto. */
const VACIAR = `(() => {
  const btn = [...document.querySelectorAll("a, button")].find((b) =>
    /vaciar|vaciar carrito|empty/i.test((b.textContent || "").trim())
  );
  if (btn) { btn.click(); return "vaciando"; }
  return "sin boton de vaciar";
})()`;

const LEER = `(() => {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.display !== "none";
  };
  const txt = (el) => (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim();
  const envio = [...document.querySelectorAll('input[name^="shipping_method"]')]
    .filter(vis)
    .map((el) => txt(el.closest("label") || el.parentElement));
  const items = [...document.querySelectorAll(".cart_item, [class*=cart-item]")]
    .map((el) => txt(el).slice(0, 80))
    .slice(0, 5);
  return JSON.stringify({ envio, items });
})()`;

const leer = () => JSON.parse(orca(["eval", "--page", page, "--expression", LEER, "--json"])).result.result;

orca(["goto", "--url", `${BASE}/carrito/`, "--page", page, "--json"]);
await dormir(4000);
console.log("carrito antes:", leer());

console.log("vaciando:", orca(["eval", "--page", page, "--expression", VACIAR, "--json"]).includes("vaciando") ? "sí" : "no");
await dormir(5000);

orca(["goto", "--url", `${BASE}/producto/${slug}/`, "--page", page, "--json"]);
await dormir(5000);

const COMPRAR = `(() => {
  const btn = [...document.querySelectorAll("button, a")].find((b) => (b.textContent || "").trim() === "Comprar");
  if (!btn) return "sin boton Comprar";
  btn.click();
  return "click";
})()`;
console.log("comprar:", orca(["eval", "--page", page, "--expression", COMPRAR, "--json"]).includes("click") ? "ok" : "fallo");
await dormir(6000);

orca(["goto", "--url", `${BASE}/finalizar-compra/`, "--page", page, "--json"]);
await dormir(7000);

console.log(`\nslug: ${slug}`);
console.log(leer());
