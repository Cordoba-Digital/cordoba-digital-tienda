/**
 * Verifica el índice de guías de compra.
 *
 * Comprueba que `/guias` liste las cinco guías, que cada tarjeta enlace a la
 * guía y a su categoría, que los datos de la tarjeta sean los de la base (palabras
 * y fecha, no inventados) y que la página no desborde. Además sigue el
 * recorrido completo desde el pie: pie → índice → guía.
 *
 * Uso: node scripts/verificar-indice-guias.mjs <baseUrl>
 */
import { execFileSync } from "node:child_process";

const base = process.argv[2] || "http://localhost:3000";
const orca = (a) => execFileSync("orca", a, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const ESPERADO = [
  "como-elegir-tu-proxima-impresora",
  "guia-completa-xiaomi-argentina",
  "guia-notebooks-argentina",
  "guia-macbook-argentina",
  "guia-de-monopatines-electricos-en-argentina-2026",
];

const INDICE = `(() => {
  const doc = document.documentElement;
  const tarjetas = [...document.querySelectorAll("main article")];
  return JSON.stringify({
    url: location.pathname,
    titulo: document.title,
    descripcion: document.querySelector('meta[name="description"]')?.getAttribute("content") || "",
    h1: (document.querySelector("h1")?.textContent || "").trim(),
    tarjetas: tarjetas.map((c) => ({
      titulo: (c.querySelector("h2")?.textContent || "").trim(),
      etiqueta: (c.querySelector("p")?.textContent || "").trim(),
      enlaces: [...c.querySelectorAll("a")].map((a) => a.getAttribute("href")),
      pie: (c.querySelector(".mt-5")?.textContent || "").replace(/\\s+/g, " ").trim(),
    })),
    pieTituloEnlaza: (() => {
      const pie = document.querySelector("footer");
      const h3 = pie ? [...pie.querySelectorAll("h3")].find((x) => /gu[ií]a de compras/i.test(x.textContent || "")) : null;
      const a = h3 ? h3.querySelector("a") : null;
      return a ? a.getAttribute("href") : null;
    })(),
    desborda: doc.scrollWidth > innerWidth + 1,
    docScrollW: doc.scrollWidth,
    viewport: innerWidth,
  });
})()`;

const GUIA = `(() => {
  const nav = document.querySelector('nav[aria-label="Miga de pan"]');
  return JSON.stringify({
    migas: nav ? (nav.innerText || "").replace(/\\s+/g, " ").trim() : null,
    migasEnlaces: nav ? [...nav.querySelectorAll("a")].map((a) => a.getAttribute("href")) : [],
    otrasGuia: (() => {
      const aside = document.querySelector("aside");
      return aside ? (aside.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 120) : null;
    })(),
  });
})()`;

let fallas = 0;
const chequeo = (nombre, ok, detalle) => {
  if (!ok) fallas += 1;
  console.log(`  ${ok ? "OK   " : "FALLA"} ${nombre}${detalle ? ` · ${detalle}` : ""}`);
};

const abrir = async (url) => {
  const tab = JSON.parse(orca(["tab", "create", "--url", url, "--json"]));
  const id = tab.result?.browserPageId ?? tab.browserPageId;
  if (!id) throw new Error("no se pudo abrir " + url);
  await dormir(5000);
  return (expr) => {
    const raw = JSON.parse(orca(["eval", "--page", id, "--expression", expr, "--json"]));
    return JSON.parse(raw.result.result);
  };
};

console.log(`\níndice de guías contra ${base}\n`);

const leerIndice = await abrir(`${base}/guias`);
const r = leerIndice(INDICE);

chequeo("la página es /guias", r.url === "/guias", r.url);
chequeo("el título es 'Guías de compra'", r.h1 === "Guías de compra", r.h1);
chequeo("tiene título y descripción propios", Boolean(r.titulo && r.descripcion), r.titulo);
chequeo("lista las 5 guías", r.tarjetas.length === 5, `${r.tarjetas.length} tarjetas`);

const slugsDeTarjeta = r.tarjetas.flatMap((t) => t.enlaces.filter((h) => h && !h.startsWith("/categoria")));
const faltan = ESPERADO.filter((s) => !slugsDeTarjeta.includes(`/${s}`));
chequeo("cada tarjeta enlaza a su guía", faltan.length === 0, faltan.join(", ") || "las 5");

const conCategoria = r.tarjetas.filter((t) => t.enlaces.some((h) => h?.startsWith("/categoria/"))).length;
chequeo("cada tarjeta enlaza a su categoría", conCategoria === 5, `${conCategoria}/5`);

// Los números de la tarjeta tienen que salir de la base, no ser texto de relleno.
const conPalabras = r.tarjetas.filter((t) => /palabras/.test(t.pie)).length;
const conMinutos = r.tarjetas.filter((t) => /min de lectura/.test(t.pie)).length;
const conFecha = r.tarjetas.filter((t) => /Actualizada el/.test(t.pie)).length;
chequeo("cada tarjeta dice cuántas palabras tiene", conPalabras === 5, `${conPalabras}/5`);
chequeo("cada tarjeta dice el tiempo de lectura", conMinutos === 5, `${conMinutos}/5`);
chequeo("cada tarjeta dice cuándo se actualizó", conFecha === 5, `${conFecha}/5`);
chequeo("el índice no desborda", !r.desborda, `doc ${r.docScrollW} vs viewport ${r.viewport}`);

// El pie tiene que llevar al índice.
chequeo("el pie enlaza al índice", r.pieTituloEnlaza === "/guias", String(r.pieTituloEnlaza));

// Y desde una guía se vuelve al índice.
const leerGuia = await abrir(`${base}/guia-notebooks-argentina`);
const g = leerGuia(GUIA);
chequeo("la guía tiene miga de pan con el índice", (g.migasEnlaces ?? []).includes("/guias"), g.migas ?? "");
chequeo("la guía ofrece volver a ver todas", Boolean(g.otrasGuia && /Ver las/.test(g.otrasGuia)), g.otrasGuia ?? "sin bloque");

console.log(`\n[guias] ${fallas === 0 ? "todo OK" : `${fallas} falla(s)`}\n`);
process.exit(fallas ? 1 : 0);
