/**
 * Vuelca las opciones de un <select> del checkout original.
 *
 * La provincia no es un texto libre: WooCommerce la guarda con un código
 * interno por provincia ("U" = Chubut, "X" = Córdoba, etc.). Para medir los
 * costos de envío por destino hay que mandar ese código, no el nombre.
 *
 * Uso: node scripts/read-select.mjs <pageId> <selector>
 */
import { execFileSync } from "node:child_process";

const [page, selector] = process.argv.slice(2);
if (!page || !selector) {
  console.error("uso: node scripts/read-select.mjs <pageId> <selector>");
  process.exit(1);
}

const orca = (a) => execFileSync("orca", a, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

const EXPR = `(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return JSON.stringify({ encontrado: false });
  return JSON.stringify(
    {
      encontrado: true,
      valor: el.value,
      opciones: [...el.options].map((o) => ({ valor: o.value, texto: o.text.trim() })),
    },
    null,
    1,
  );
})()`;

const raw = JSON.parse(orca(["eval", "--page", page, "--expression", EXPR, "--json"]));
console.log(raw.result.result);
