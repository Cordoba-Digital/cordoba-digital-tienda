/**
 * Mide la galería de la ficha de producto en la página viva.
 *
 * Lo que mira:
 * - cuántas miniaturas hay y si cada una muestra una foto DISTINTA (el bug del
 *   srcset mezclado hacía que todas mostraran la misma);
 * - si el `srcset` de alguna miniatura puede cargar una foto que no es la suya;
 * - que el marco de la foto no se desborde.
 *
 * Uso: node scripts/measure-gallery.mjs <pageId> <url>
 */
import { execFileSync } from "node:child_process";

const [page, url] = process.argv.slice(2);
if (!page) {
  console.error("uso: node scripts/measure-gallery.mjs <pageId> <url>");
  process.exit(1);
}

const orca = (a) => execFileSync("orca", a, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
if (url) orca(["goto", "--url", url, "--page", page, "--json"]);

const baseOf = (u) => u.replace(/-\d+x\d+(?=\.[a-z0-9]+$)/i, "");

const EXPR = `(() => {
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  };
  const base = (u) => u.replace(/-\\d+x\\d+(?=\\.[a-z0-9]+$)/i, "");

  // Miniaturas: botones cuadrados al lado de la foto principal.
  const thumbs = [...document.querySelectorAll("button")].filter((b) => {
    const img = b.querySelector("img[srcset]");
    if (!img) return false;
    const r = b.getBoundingClientRect();
    return Math.abs(r.width - r.height) < 6 && r.width > 48 && r.width < 200;
  });

  const detalle = thumbs.map((b, i) => {
    const img = b.querySelector("img[srcset]");
    const srcset = img.getAttribute("srcset") || "";
    const propias = new Set(
      srcset
        .split(",")
        .map((e) => e.trim().split(/\\s+/)[0])
        .filter(Boolean)
        .map(base),
    );
    const cargada = base((img.currentSrc || img.src).split("?")[0]);
    return {
      i,
      cargada: (img.currentSrc || img.src).split("/").pop().slice(0, 44),
      dentroDeSuPropioSrcset: propias.has(cargada),
      variantes: propias.size,
      thumb: box(b),
    };
  });

  const distintas = new Set(detalle.map((d) => base(d.cargada))).size;

  // La foto principal: la <img> más grande del bloque.
  const imgs = [...document.querySelectorAll("img[srcset]")].map((img) => ({ img, r: img.getBoundingClientRect() }));
  imgs.sort((a, b) => b.r.width - a.r.width);
  const principal = imgs[0];

  return JSON.stringify(
    {
      miniaturas: detalle.length,
      fotosDistintas: distintas,
      todasDentroDeSuSrcset: detalle.every((d) => d.dentroDeSuPropioSrcset),
      principal: principal
        ? { archivo: (principal.img.currentSrc || principal.img.src).split("/").pop().slice(0, 44), ...box(principal.img) }
        : null,
      marco: (() => {
        const marco = document.querySelector(".aspect-square");
        return marco ? box(marco) : null;
      })(),
      docScrollW: document.documentElement.scrollWidth,
      viewport: innerWidth,
    },
    null,
    1,
  );
})()`;

const raw = JSON.parse(orca(["eval", "--page", page, "--expression", EXPR, "--json"]));
console.log(raw.result.result);
