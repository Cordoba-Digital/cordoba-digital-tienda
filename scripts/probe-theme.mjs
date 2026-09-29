/**
 * Mide en el navegador los valores reales de las superficies y del texto.
 *
 * Un bug de tema no se detecta leyendo el CSS: hay que ver que valor resuelve
 * cada variable en cada elemento. Este script consulta el DOM de la pagina
 * viva y devuelve el par variable-valor que se esta usando.
 */
import { execFileSync } from "node:child_process";

const page = process.argv[2];
const url = process.argv[3];

const orca = (args) =>
  execFileSync("orca", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

if (url) orca(["goto", "--url", url, "--page", page, "--json"]);

const EXPR = `(() => {
  const root = document.documentElement;
  const cs = (sel, prop) => {
    const el = document.querySelector(sel);
    return el ? getComputedStyle(el)[prop] : "(no existe) " + sel;
  };
  const out = {
    dark: root.classList.contains("dark"),
    vars: {
      surface: getComputedStyle(root).getPropertyValue("--color-surface").trim(),
      ink800: getComputedStyle(root).getPropertyValue("--color-ink-800").trim(),
      ink700: getComputedStyle(root).getPropertyValue("--color-ink-700").trim(),
      ink600: getComputedStyle(root).getPropertyValue("--color-ink-600").trim(),
    },
    chips: [...document.querySelectorAll("a,button,span")]
      .filter((e) => e.className && /\\bbg-surface\\b/.test(e.className))
      .slice(0, 3)
      .map((e) => ({
        texto: e.textContent.trim().slice(0, 28),
        bg: getComputedStyle(e).backgroundColor,
        color: getComputedStyle(e).color,
        clases: e.className.slice(0, 90),
      })),
    nombres: [...document.querySelectorAll("a")]
      .filter((e) => /text-ink-800/.test(e.className || ""))
      .slice(0, 2)
      .map((e) => ({ texto: e.textContent.trim().slice(0, 30), color: getComputedStyle(e).color })),
    body: { bg: getComputedStyle(document.body).backgroundColor, color: getComputedStyle(document.body).color },
  };
  return JSON.stringify(out, null, 1);
})()`;

const raw = JSON.parse(orca(["eval", "--page", page, "--expression", EXPR, "--json"]));
console.log(raw.result?.result ?? JSON.stringify(raw));
