/**
 * Mide las cajas reales de las tarjetas de producto en la página viva.
 *
 * Por qué hace falta: el HTML y el CSS pueden estar bien y aun así la imagen
 * renderizarse gigante. Solo mirando `getBoundingClientRect()` de la tarjeta,
 * del contenedor y de la `<img>` se ve cuál de los tres se rompió.
 *
 * Uso: node scripts/measure-grid.mjs <pageId> [url]
 */
import { execFileSync } from "node:child_process";

const page = process.argv[2];
const url = process.argv[3];
if (!page) {
  console.error("uso: node scripts/measure-grid.mjs <pageId> [url]");
  process.exit(1);
}

const orca = (a) => execFileSync("orca", a, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

if (url) orca(["goto", "--url", url, "--page", page, "--json"]);

const EXPR = `(() => {
  const arts = [...document.querySelectorAll("article")].slice(0, 6);
  const out = arts.map((a, i) => {
    const im = a.querySelector("img");
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return Math.round(r.width) + "x" + Math.round(r.height);
    };
    return {
      i,
      src: (im?.currentSrc || im?.src || "").split("/").pop().slice(0, 40),
      tarjeta: box(a),
      marco: im ? box(im.parentElement) : "-",
      img: im ? box(im) : "-",
      natural: im ? im.naturalWidth + "x" + im.naturalHeight : "-",
      objectFit: im ? getComputedStyle(im).objectFit : "-",
    };
  });
  const grid = document.querySelector("article")?.closest("[class*=grid]");
  const gs = grid ? getComputedStyle(grid) : null;
  // Se sube desde la grilla para ver quién impone el ancho real: si el layout
  // con la sidebar no aparece como grid, el problema está un nivel más arriba.
  const chain = [];
  let el = grid;
  for (let i = 0; el && i < 7; i++) {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    chain.push({
      tag: el.tagName.toLowerCase(),
      clase: (el.className || "").slice(0, 96),
      w: Math.round(r.width),
      display: s.display,
      template: s.templateColumns || s.gridTemplateColumns,
      minWidth: s.minWidth,
      overflowX: s.overflowX,
    });
    el = el.parentElement;
  }
  return JSON.stringify(
    {
      viewport: innerWidth + "x" + innerHeight,
      docScrollW: document.documentElement.scrollWidth,
      bodyScrollW: document.body.scrollWidth,
      gridTemplateColumns: gs ? gs.gridTemplateColumns : null,
      cadena: chain,
      tarjetas: out,
    },
    null,
    1,
  );
})()`;

const raw = JSON.parse(orca(["eval", "--page", page, "--expression", EXPR, "--json"]));
console.log(typeof raw === "string" ? raw : JSON.stringify(raw, null, 2));
