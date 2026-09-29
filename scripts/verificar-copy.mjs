/**
 * Verifica que no queden afirmaciones inventadas en las páginas públicas.
 *
 * El sitio se migró de WooCommerce y hay que copiarlo tal cual: el copy de la
 * home, del checkout, de la ficha de producto y del centro de ayuda tiene que salir de
 * datos reales del sitio original, no de suposiciones. Esta lista es la de las
 * afirmaciones que se sacaron por no existir en el original, y sirve de alarma
 * para que no vuelvan.
 *
 * Uso: node scripts/verificar-copy.mjs <baseUrl>
 */
import { execFileSync } from "node:child_process";

const base = process.argv[2] || "http://localhost:3000";
const orca = (a) => execFileSync("orca", a, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Texto que NO debe aparecer en ninguna página, con el motivo. */
const PROHIBIDO = [
  ["15% OFF", "no existe en el checkout del original"],
  ["15 %", "idem"],
  ["moto express", "el original no tiene servicio propio de moto"],
  ["12 meses de garantía", "la política de garantía del original dice 6 meses (Ley 24.240)"],
  ["10 días para cambios", "no figura en la política del original"],
  ["11:00 a 14:00", "el horario real del sábado es 12:00 a 14:30"],
  ["11:00 - 14:00", "idem"],
  ["Factura A/B", "el original habla de comprobante de compra o factura"],
  ["listo en 2 horas", "el original no promete tiempo de retiro"],
  ["retiro en 2 hs", "idem"],
  ["Comprar ahora", "el original tiene un solo botón: Comprar"],
];

const PAGINAS = ["/", "/producto/iphone-18-pro-max-512gb", "/ayuda", "/carrito", "/productos"];

let pagina = null;
const evalEn = (expr) => {
  const args = pagina ? ["--page", pagina, "--expression", expr, "--json"] : ["--expression", expr, "--json"];
  const raw = JSON.parse(orca(["eval", ...args]));
  if (!raw.ok) throw new Error(raw.error?.message ?? "fallo el eval");
  return raw.result.result;
};

const LEER = `(() => JSON.stringify({
  url: location.pathname,
  texto: (document.body.innerText || "").replace(/\\s+/g, " "),
}))()`;

const fallas = [];
console.log(`copy sin inventos contra ${base}\n`);

for (const ruta of PAGINAS) {
  const tab = JSON.parse(orca(["tab", "create", "--url", `${base}${ruta}`, "--json"]));
  pagina = tab.browserPageId;
  await dormir(4000);

  const datos = JSON.parse(evalEn(LEER));
  const malos = PROHIBIDO.filter(([aguja]) => datos.texto.toLowerCase().includes(aguja.toLowerCase()));
  if (malos.length === 0) {
    console.log(`  OK   ${ruta}  (${datos.texto.length} caracteres revisados)`);
  } else {
    console.log(`  FALLA ${ruta}`);
    for (const [aguja, motivo] of malos) {
      console.log(`        "${aguja}" — ${motivo}`);
      fallas.push(`${ruta}: ${aguja}`);
    }
  }
}

console.log(`\n[copy] ${PAGINAS.length - new Set(fallas.map((f) => f.split(":")[0])).size}/${PAGINAS.length} páginas limpias`);
process.exit(fallas.length ? 1 : 0);
