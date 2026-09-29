/**
 * Cliquea el primer botón o link que CONTIENE un texto y devuelve a dónde llevó.
 *
 * `click-and-read.mjs` exige coincidencia exacta del texto, y eso se rompe con
 * los emojis cuando el texto pasa por la línea de comandos de PowerShell (los
 * deja como signos de pregunta). Buscar por texto contenido es más robusto.
 *
 * Uso: node scripts/click-parcial.mjs <pageId> <fragmento de texto> [esperaMs]
 */
import { execFileSync } from "node:child_process";

const [page, texto, esperaMs] = process.argv.slice(2);
if (!page || !texto) {
  console.error("uso: node scripts/click-parcial.mjs <pageId> <fragmento> [esperaMs]");
  process.exit(1);
}

const orca = (a) => execFileSync("orca", a, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

const CLICK = `(() => {
  const objetivo = [...document.querySelectorAll("button, a")].find((b) => {
    const t = (b.innerText || b.textContent || "").replace(/\\s+/g, " ").trim();
    return t.includes(${JSON.stringify(texto)}) && b.getBoundingClientRect().width > 0;
  });
  if (!objetivo) return JSON.stringify({ encontrado: false });
  objetivo.scrollIntoView({ block: "center" });
  objetivo.click();
  return JSON.stringify({ encontrado: true, etiqueta: (objetivo.innerText || "").replace(/\\s+/g, " ").trim() });
})()`;

console.log(orca(["eval", "--page", page, "--expression", CLICK, "--json"]).slice(0, 400));
await new Promise((r) => setTimeout(r, Number(esperaMs || 3000)));

const LEER = `(() => JSON.stringify({ url: location.href, titulo: document.title }))()`;
const raw = JSON.parse(orca(["eval", "--page", page, "--expression", LEER, "--json"]));
console.log(raw.result.result);
