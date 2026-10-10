/**
 * Recorre rutas y avisa de las que desbordan en horizontal.
 *
 * Un desborde horizontal no se ve leyendo el HTML: las clases de Tailwind
 * pueden estar correctas y aun así un `1fr` que no cede estirar la grilla a
 * 5.900 px (pasó en `/productos`, con 2.588 productos y 108 páginas). Por eso
 * se mide `documentElement.scrollWidth` contra el ancho del viewport, que es
 * lo que un usuario sí nota.
 *
 * El crawler de `audit-site.ts` no lo detectaba: daba 200 en todas las rutas y
 * solo comprobaba status y titles.
 *
 * OJO: el ancho lo impone la ventana del navegador embebido de Orca, no este
 * script. Por eso el resultado incluye el viewport real: si se lo corre dos
 * veces esperando anchos distintos y el número no cambia, no se midió nada
 * nuevo. Para probar mobile de verdad hay que redimensionar la ventana desde
 * la UI, no pasar `--viewport`.
 *
 * Uso:
 *   node scripts/audit-overflow.mjs                       # sitio por defecto
 *   node scripts/audit-overflow.mjs http://localhost:3112 # local
 */
import { execFileSync } from "node:child_process";

const argv = process.argv.slice(2);
const base = (argv.find((a) => !a.startsWith("--")) ?? "https://cordoba-digital.vercel.app").replace(/\/+$/, "");

const orca = (a) => execFileSync("orca", a, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Rutas representativas de cada layout con sidebar y de cada tipo de página. */
const PATHS = [
  "/",
  "/productos",
  "/productos?page=2",
  "/productos?ofertas=1",
  "/categoria/computacion",
  "/categoria/computacion/notebooks",
  "/categoria/celulares-liberados",
  "/producto/iphone-18-pro-max-512gb",
  "/producto/macbook-neo-13-8gb-256gb-silver",
  "/carrito",
  "/favoritos",
  "/checkout",
  "/ayuda",
  "/cuenta/pedidos",
  "/no-existe-esta-ruta",
];

const EXPR = (path) => `(() => {
  const w = innerWidth;
  const sw = document.documentElement.scrollWidth;
  if (sw <= w + 2) return JSON.stringify({ ok: true, sw, w });
  const culpables = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.right > w + 2 || r.width > w + 2) {
      culpables.push({
        tag: el.tagName.toLowerCase(),
        clase: (el.className || "").toString().slice(0, 70),
        w: Math.round(r.width),
        right: Math.round(r.right),
      });
    }
  }
  // Se queda el más ancho: suele ser el que arrastra la página.
  culpables.sort((a, b) => b.w - a.w);
  return JSON.stringify({ ok: false, sw, w, culpables: culpables.slice(0, 3) });
})()`;

const tab = JSON.parse(orca(["tab", "create", "--json", "--url", base + "/"])).result.browserPageId;
// El viewport real lo impone la ventana del navegador; se informa para que quede
// claro con qué ancho se midió.
const vp = JSON.parse(
  orca(["eval", "--page", tab, "--expression", "innerWidth + 'x' + innerHeight", "--json"]),
).result.result;
console.log(`[overflow] ${base} · viewport real ${vp}\n`);

let fallos = 0;
for (const path of PATHS) {
  try {
    orca(["goto", "--url", base + path, "--page", tab, "--json"]);
    const raw = JSON.parse(orca(["eval", "--page", tab, "--expression", EXPR(path), "--json"]));
    // `orca eval --json` anida el valor en `result.result` como string.
    const payload = raw?.result?.result;
    const r = typeof payload === "string" ? JSON.parse(payload) : payload;
    if (!r) throw new Error(`respuesta inesperada: ${JSON.stringify(raw).slice(0, 120)}`);
    if (r.ok) {
      console.log(`  OK    ${path}`);
    } else {
      fallos += 1;
      console.log(`  DESBORDE ${path}  (${r.sw}px vs ${r.w}px)`);
      for (const c of r.culpables) console.log(`           ${c.tag}.${c.clase} → ${c.w}px`);
    }
  } catch (error) {
    console.log(`  ERROR ${path}: ${String(error.message).slice(0, 90)}`);
  }
}

console.log(`\n[overflow] ${PATHS.length - fallos}/${PATHS.length} rutas sin desborde`);
process.exit(fallos ? 1 : 0);
