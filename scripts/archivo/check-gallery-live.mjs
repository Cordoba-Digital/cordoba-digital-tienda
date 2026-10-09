/**
 * Verifica en la pagina viva que la galeria usa un srcset por foto.
 *
 * El arreglo de `imageSrcSets` venia de otra sesion y se publico sin que nadie
 * lo revisara en el navegador. Antes el array era plano y la galeria pasaba el
 * mismo a cada miniatura, asi que todas mostraban la misma imagen; el sintoma es
 * visible en el `src` que eligio el navegador de cada miniatura.
 */
import { execFileSync } from "node:child_process";

const page = process.argv[2];
const url = process.argv[3];

const orca = (a) => execFileSync("orca", a, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

orca(["goto", "--url", url, "--page", page, "--json"]);

const EXPR = `(() => {
  const imgs = [...document.querySelectorAll("img[srcset]")];
  const enGaleria = imgs.filter((i) => i.closest("aside, [data-galeria], figure") || i.className.includes("aspect-square"));
  const elegidos = imgs.slice(0, 12).map((i) => ({
    alt: (i.alt || "").slice(0, 34),
    src: (i.currentSrc || i.src).split("/").pop().slice(0, 46),
    variantes: (i.getAttribute("srcset") || "").split(",").length,
  }));
  const distintos = new Set(elegidos.map((e) => e.src)).size;
  return JSON.stringify(
    {
      totalConSrcset: imgs.length,
      miniaturasDistintas: distintos,
      totalRevisadas: elegidos.length,
      ejemplos: elegidos.slice(0, 6),
    },
    null,
    1,
  );
})()`;

const raw = JSON.parse(orca(["eval", "--page", page, "--expression", EXPR, "--json"]));
console.log(raw.result?.result ?? JSON.stringify(raw));
