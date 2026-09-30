/**
 * Mide el contraste real de los textos sobre el fondo que tienen detrás.
 *
 * Se mide en el navegador y no con una fórmula sobre el CSS porque Tailwind v4
 * emite los colores en oklch() y lab(), y la conversión manual se equivoca. La
 * forma confiable es poner el color en un canvas y leer el byte que queda: el
 * navegador lo pasa a sRGB, que es lo comparable.
 *
 * Cada color se sube por el árbol hasta encontrar un fondo opaco, porque
 * muchas cards tienen fondo transparente y heredan el de la página.
 *
 * Umbrales de WCAG 2.1 AA: 4,5:1 para texto normal, 3:1 para texto grande
 * (24px, o 18,66px si está en negrita).
 *
 * Uso: node scripts/check-contraste.mjs <url> [selectorExtra]
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9355;
const url = process.argv[2] || "http://localhost:3000/";

const MEDIR = `(function () {
  var cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  var ctx = cv.getContext("2d", { willReadFrequently: true });

  function aRgba(color) {
    if (!color) return null;
    var s = String(color).trim();
    if (s === "transparent") return [0, 0, 0, 0];
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = s;
    ctx.fillRect(0, 0, 1, 1);
    var d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  }

  function lum(rgb) {
    var c = rgb.map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  function ratio(fg, bg) {
    var a = lum(fg), b = lum(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }

  function fondoDe(el) {
    var n = el;
    while (n && n !== document.documentElement) {
      var c = aRgba(getComputedStyle(n).backgroundColor);
      if (c && c[3] > 0.85) return c;
      n = n.parentElement;
    }
    return [255, 255, 255, 1];
  }

  /*
   * El contraste no se puede calcular cuando el texto va sobre un degradado o
   * sobre una foto: no hay un color de fondo, hay una imagen. Medirlo da
   * disparates (por ejemplo blanco sobre blanco, 1:1) y el control termina
   * reportando fallas que no existen. Esos casos se informan aparte como "no
   * verificable" para que sean una decisión de la persona y no un falso rojo.
   */
  function sobreImagen(el) {
    var n = el;
    var salto = 0;
    while (n && n !== document.documentElement && salto < 8) {
      var cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== "none") {
        return "degradado en " + n.tagName.toLowerCase();
      }
      // Un bloque posicionado encima de un contenedor relativo que tiene una
      // <img> es el caso tipico: el bloque de texto sobre la foto del local.
      if (cs.position === "absolute" || cs.position === "fixed") {
        var contenedor = n.offsetParent;
        if (contenedor && contenedor.querySelector("img")) {
          return "imagen de fondo en " + contenedor.tagName.toLowerCase();
        }
      }
      n = n.parentElement;
      salto += 1;
    }
    return null;
  }

  var salida = [];
  var noVerificables = [];
  var vistos = {};
  var vistosNoVerificables = {};
  var nodos = document.querySelectorAll("p, span, a, button, h1, h2, h3, h4, li, label, dt, dd, td, th, small, strong, em");

  Array.prototype.forEach.call(nodos, function (el) {
    // Solo texto propio, no el que heredan los hijos.
    var propio = "";
    Array.prototype.forEach.call(el.childNodes, function (n) {
      if (n.nodeType === 3) propio += n.nodeValue;
    });
    if (!propio.trim()) return;

    var cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") return;
    if (parseFloat(cs.opacity) < 0.6) return;

    // WCAG 1.4.3 exime a los componentes inactivos: un botón deshabilitado
    // puede quedar por debajo del mínimo sin que sea un problema. Por eso el
    // "+" del selector de cantidad daba 1,48:1 y no lo accountamos.
    if (el.disabled === true || el.getAttribute("aria-disabled") === "true") return;

    var fg = aRgba(cs.color);
    if (!fg || fg[3] < 0.6) return;

    var px = parseFloat(cs.fontSize);
    var bold = parseInt(cs.fontWeight, 10) >= 700;
    var grande = px >= 24 || (bold && px >= 18.66);
    var minimo = grande ? 3 : 4.5;

    var imagen = sobreImagen(el);
    if (imagen) {
      var claveNv = String(el.className || "").replace(/\\s+/g, " ").trim();
      if (!vistosNoVerificables[claveNv]) {
        vistosNoVerificables[claveNv] = true;
        noVerificables.push({
          texto: propio.trim().slice(0, 34),
          motivo: imagen,
          selector: el.tagName.toLowerCase() + (claveNv ? "." + claveNv.split(" ").join(".") : ""),
        });
      }
      return;
    }

    var r = ratio(fg, fondoDe(el));

    if (r >= minimo) return;

    var clase = el.className && el.className.baseVal === undefined ? String(el.className) : "";
    // Se agrupa por la clase completa y no solo por las de color: si se
    // agrupara solo por las clases de texto, dos elementos distintos con la
    // misma variable (por ejemplo la marca del producto y el precio tachado)
    // se taparían entre sí y el control reportaría solo uno de los dos.
    var clave = clase.replace(/\\s+/g, " ").trim();
    if (!vistos[clave]) {
      vistos[clave] = true;
      salida.push({
        texto: propio.trim().slice(0, 34),
        clases: clave || "(sin clase de color)",
        px: px,
        bold: bold,
        ratio: Math.round(r * 100) / 100,
        minimo: minimo,
        selector: el.tagName.toLowerCase() + (clase ? "." + clase.trim().split(/\\s+/).join(".") : ""),
      });
    }
  });

  salida.sort(function (a, b) { return a.ratio - b.ratio; });
  return JSON.stringify({ url: location.pathname, total: salida.length, falla: salida, noVerificables: noVerificables }, null, 1);
})()`;

const perfil = mkdtempSync(join(tmpdir(), "cdp-"));
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${perfil}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--window-size=1400,1000",
    "about:blank",
  ],
  { stdio: "ignore", windowsHide: true },
);

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function esperarChrome() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`, { signal: AbortSignal.timeout(1500) });
      if (r.ok) return;
    } catch {
      /* todavia no levanta */
    }
    await dormir(250);
  }
  throw new Error("Chrome no levanto el puerto de depuracion");
}

function cliente(ws) {
  let id = 0;
  const pend = new Map();
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    const p = pend.get(m.id);
    if (!p) return;
    pend.delete(m.id);
    clearTimeout(p.t);
    if (m.error) p.rej(new Error(JSON.stringify(m.error)));
    else p.res(m.result);
  });
  return (method, params = {}) =>
    new Promise((res, rej) => {
      id += 1;
      const t = setTimeout(() => rej(new Error("timeout " + method)), 60000);
      pend.set(id, { res, rej, t });
      ws.send(JSON.stringify({ id, method, params }));
    });
}

let total = 0;
try {
  await esperarChrome();
  const tab = await (
    await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: "PUT" })
  ).json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener("open", res, { once: true });
    ws.addEventListener("error", rej, { once: true });
  });
  const enviar = cliente(ws);
  await enviar("Page.enable");
  await enviar("Page.navigate", { url });
  await dormir(6000);
  const r = await enviar("Runtime.evaluate", { expression: MEDIR, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "error en la pagina");
  const salida = JSON.parse(r.result.value);
  total = salida.total;
  console.log(`contraste en ${salida.url}: ${salida.total} combinaciones que no pasan AA\n`);
  for (const f of salida.falla) {
    console.log(`  ${f.ratio}:1  (pide ${f.minimo})  ${f.px}px${f.bold ? " bold" : ""}  ${f.clases}`);
    console.log(`      "${f.texto}"`);
  }
  if (salida.noVerificables.length) {
    console.log(`\n  no verificables (texto sobre foto o degradado, hay que mirarlos a ojo): ${salida.noVerificables.length}`);
    for (const nv of salida.noVerificables) {
      console.log(`      "${nv.texto}" — ${nv.motivo}`);
    }
  }
  ws.close();
} catch (e) {
  console.error(`ERROR: ${e.message}`);
  process.exitCode = 1;
} finally {
  chrome.kill();
  try {
    rmSync(perfil, { recursive: true, force: true });
  } catch {
    /* da igual */
  }
}

process.exitCode = total > 0 ? 1 : 0;
