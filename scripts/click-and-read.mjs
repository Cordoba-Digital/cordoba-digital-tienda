/**
 * Clickea un botón por su texto y devuelve la URL + los textos visibles.
 *
 * Por qué hace falta: para ver a dónde lleva cada botón del flujo de compra hay
 * que ejecutarlo de verdad; el HTML servido no siempre incluye lo que se dibuja
 * en el cliente (pasos del checkout, contenido de carrito, etc.).
 *
 * Uso: node scripts/click-and-read.mjs <pageId> <texto del botón> [esperaMs]
 */
import { execFileSync } from "node:child_process";

const [page, texto, esperaMs] = process.argv.slice(2);
if (!page || !texto) {
  console.error("uso: node scripts/click-and-read.mjs <pageId> <texto del botón> [esperaMs]");
  process.exit(1);
}

const orca = (a) => execFileSync("orca", a, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

const CLICK = `(() => {
  const btn = [...document.querySelectorAll("button, a")].find((b) =>
    (b.textContent || "").trim().toLowerCase() === ${JSON.stringify(texto.toLowerCase())}
  );
  if (!btn) {
    const cerca = [...document.querySelectorAll("button, a")]
      .map((b) => (b.textContent || "").trim())
      .filter((t) => t.length > 0 && t.length < 40);
    return JSON.stringify({ encontrado: false, botones: [...new Set(cerca)].slice(0, 25) });
  }
  btn.scrollIntoView({ block: "center" });
  btn.click();
  return JSON.stringify({ encontrado: true, etiqueta: (btn.textContent || "").trim() });
})()`;

console.log("click:", orca(["eval", "--page", page, "--expression", CLICK, "--json"]).trim());
await new Promise((r) => setTimeout(r, Number(esperaMs || 3000)));

const LEER = `(() => {
  const textos = [...document.querySelectorAll("h1, h2, h3, label, legend, button, a, p, li, dt, dd, span")]
    .filter((el) => el.children.length === 0)
    .map((el) => (el.textContent || "").trim())
    .filter((t) => t.length > 1 && t.length < 90);
  return JSON.stringify(
    {
      url: location.href,
      titulo: document.title,
      visibles: [...new Set(textos)].slice(0, 90),
    },
    null,
    1,
  );
})()`;

const raw = JSON.parse(orca(["eval", "--page", page, "--expression", LEER, "--json"]));
console.log(raw.result.result);
