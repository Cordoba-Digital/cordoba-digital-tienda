/**
 * Mide los costos de envío reales del sitio original para una lista de códigos
 * postales.
 *
 * Por qué existe: los costos de envío del deploy salen de una tabla de zonas que
 * ARMÓ el agente a partir de la notación del código (`4_900_00` → $4.900). Eso
 * es una suposición, no un dato. El checkout de WooCommerce calcula el envío con
 * el plugin de Andreani, así que la única forma de tener los valores reales es
 * leerlos del checkout original con cada CP y ver qué cobra.
 *
 * El checkout es un formulario clásico: hay que setear provincia/localidad/CP y
 * disparar el `change` para que WooCommerce pida los tariffs por AJAX.
 *
 * Uso: node scripts/measure-envio-original.mjs <pageId> [salida.json]
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const [page, salida] = process.argv.slice(2);
if (!page) {
  console.error("uso: node scripts/measure-envio-original.mjs <pageId> [salida.json]");
  process.exit(1);
}

const orca = (a) => execFileSync("orca", a, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * CPs de prueba: capital, interior y las zonas más caras.
 *
 * La provincia va con el código interno de WooCommerce, no con el nombre: el
 * `<select>` de provincia usa "X" para Córdoba, "U" para Chubut, etc. Mandar el
 * nombre no matchea ninguna opción y el checkout no recalcula nada.
 */
const CASOS = [
  { cp: "5000", ciudad: "Córdoba", provincia: "X", etiqueta: "Córdoba Capital" },
  { cp: "5800", ciudad: "Río Cuarto", provincia: "X", etiqueta: "Interior de Córdoba" },
  { cp: "1000", ciudad: "Buenos Aires", provincia: "C", etiqueta: "CABA" },
  { cp: "8000", ciudad: "Bahía Blanca", provincia: "B", etiqueta: "PBA interior" },
  { cp: "2000", ciudad: "Rosario", provincia: "S", etiqueta: "Santa Fe" },
  { cp: "3000", ciudad: "Paraná", provincia: "E", etiqueta: "Litoral" },
  { cp: "5500", ciudad: "Mendoza", provincia: "M", etiqueta: "Cuyo" },
  { cp: "4000", ciudad: "San Juan", provincia: "J", etiqueta: "NOA/Cuyo" },
  { cp: "7600", ciudad: "Mar del Plata", provincia: "B", etiqueta: "Costa" },
  { cp: "9000", ciudad: "Comodoro Rivadavia", provincia: "U", etiqueta: "Patagonia" },
  { cp: "9400", ciudad: "Río Gallegos", provincia: "Z", etiqueta: "Sur" },
];

const LEER = `(() => {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
  };
  const txt = (el) => (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim();
  const opciones = [...document.querySelectorAll('input[name^="shipping_method"]')]
    .filter(vis)
    .map((el) => ({ valor: el.value, marcada: el.checked, etiqueta: txt(el.closest("label") || el.parentElement) }));
  const pagos = [...document.querySelectorAll('input[name="payment_method"]')]
    .filter(vis)
    .map((el) => ({ valor: el.value, marcada: el.checked, etiqueta: txt(el.closest("label") || el.parentElement) }));
  const total = txt(document.querySelector(".cart_totals .order-total, [class*=order-total], [class*=cart-total]") || document.body).slice(0, 200);
  return JSON.stringify({ opciones, pagos, total, url: location.href });
})()`;

const FIJAR = (cp, ciudad, provincia) => `(() => {
  // El setter de "value" cuelga del prototipo según el tipo de control: usar el
  // de HTMLInputElement sobre un <select> revienta con "Illegal invocation".
  const set = (el, valor) => {
    if (!el) return "sin campo";
    try {
      const proto =
        el.tagName === "SELECT" ? window.HTMLSelectElement.prototype
        : el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
      setter.call(el, valor);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return "ok";
    } catch (e) {
      return "error: " + e.message;
    }
  };
  const por = (nombres) => {
    for (const sel of nombres) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  };
  return JSON.stringify({
    cp: set(por(["#billing_postcode", 'input[name="billing_postcode"]', 'input[autocomplete="postal-code"]']), ${JSON.stringify(cp)}),
    ciudad: set(por(["#billing_city", 'input[name="billing_city"]', 'input[autocomplete="address-level2"]']), ${JSON.stringify(ciudad)}),
    provincia: set(por(["#billing_state", 'select[name="billing_state"]', 'input[name="billing_state"]']), ${JSON.stringify(provincia)}),
  });
})()`;

const resultados = [];

for (const caso of CASOS) {
  orca(["eval", "--page", page, "--expression", FIJAR(caso.cp, caso.ciudad, caso.provincia), "--json"]);
  // WooCommerce recalcula los tariffs por AJAX: hay que darle tiempo.
  await dormir(4500);
  const raw = JSON.parse(orca(["eval", "--page", page, "--expression", LEER, "--json"]));
  const datos = JSON.parse(raw.result.result);
  const envio = datos.opciones.filter((o) => !o.valor.startsWith("local_pickup"));
  const retiro = datos.opciones.find((o) => o.valor.startsWith("local_pickup"));
  console.log(
    `${caso.etiqueta.padEnd(28)} CP ${caso.cp}  ${envio.map((o) => o.etiqueta).join("  |  ") || "(sin tariffs)"}`,
  );
  resultados.push({ ...caso, envio, retiro: retiro ?? null, pagos: datos.pagos });
}

if (salida) {
  writeFileSync(salida, JSON.stringify(resultados, null, 2), "utf8");
  console.log(`\nescrito: ${salida}`);
}
