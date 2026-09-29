/**
 * Recorre el flujo de compra completo y verifica que el medio de pago esté a la
 * vista sin pasar por otro paso.
 *
 * Es el chequeo que hace falta después de tocar el checkout: que el botón de la
 * ficha vaya al carrito, que el carrito lleve al checkout, y que el checkout
 * muestre datos, entrega, totales y medio de pago juntos.
 *
 * Uso: node scripts/verificar-flujo-compra.mjs <baseUrl>
 */
import { execFileSync } from "node:child_process";

const base = process.argv[2] || "http://localhost:3000";
const PRODUCTO = process.argv[3] || "iphone-18-pro-max-512gb";

const orca = (a) => execFileSync("orca", a, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
let page = null;

const evalEn = (expr) => {
  const args = page ? ["--page", page, "--expression", expr, "--json"] : ["--expression", expr, "--json"];
  const raw = JSON.parse(orca(["eval", ...args]));
  if (!raw.ok) throw new Error(raw.error?.message ?? "fallo el eval");
  return raw.result.result;
};

// Coincidencia EXACTA y visible. Con "incluye"Tomaba cualquier tarjeta de
// producto relacionada, que también tiene un botón "Comprar", y se navegaba al
// producto equivocado en vez de seguir el flujo.
const CLICK_EXACTO = (texto) => `(() => {
  const objetivo = [...document.querySelectorAll("button, a")].find((b) => {
    const r = b.getBoundingClientRect();
    return (b.innerText || b.textContent || "").replace(/\\s+/g, " ").trim() === ${JSON.stringify(texto)}
      && r.width > 0 && r.height > 0;
  });
  if (!objetivo) return "NO EXISTE";
  objetivo.scrollIntoView({ block: "center" });
  objetivo.click();
  return "ok";
})()`;

const ESTADO = `(() => {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.display !== "none";
  };
  const txt = (el) => (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim();
  const titulos = [...document.querySelectorAll("h1, h2, h3")].filter(vis).map(txt).filter((t) => t.length < 60);
  const pagos = [...document.querySelectorAll("button, label")].filter(vis).map(txt).filter((t) =>
    /Transferencia bancaria|USDT \\(TRC20\\)|Mercado Pago|Efectivo en el local/.test(t)
  );
  return JSON.stringify({
    url: location.pathname,
    titulos: [...new Set(titulos)],
    pagos: [...new Set(pagos.map((p) => p.split(" Pagá")[0].split(" Reserv")[0].split(" Te env")[0].split(" Tarjeta")[0]))],
    pasos: /Tus datos|Continuar al pago/.test(document.body.innerText) ? "AUN HAY WIZARD" : "sin wizard",
    desborda: document.documentElement.scrollWidth > innerWidth + 1,
  });
})()`;

const resultados = [];
const chequeo = (nombre, ok, detalle) => {
  resultados.push({ nombre, ok });
  console.log(`  ${ok ? "OK  " : "FALLA"} ${nombre}${detalle ? ` · ${detalle}` : ""}`);
};

console.log(`flujo de compra contra ${base}\n`);

/**
 * Espera a que la página esté de verdad lista antes de mirarla.
 *
 * Con un `sleep` fijo el chequeo empieza a leer el DOM mientras todavía se está
 * armando y falla sin que haya nada roto: dio 4/13 en una corrida y 13/13 en las
 * tres siguientes del mismo build.
 *
 * No se espera `readyState === "complete"` porque en esta página nunca llega: el
 * widget de WhatsApp deja conexiones abiertas y el documento se queda en
 * "interactive" para siempre. Alcanza con que haya terminado de parsear y haya
 * texto en pantalla.
 */
async function esperarListo(intentos = 40) {
  for (let i = 0; i < intentos; i += 1) {
    // `evalEn` devuelve el string crudo de la expresión, no el valor: hay que
    // parsearlo. Compararlo contra `true` daba falso siempre y el chequeo
    // terminaba por timeout aunque la página estuviera cargada.
    const crudo = await evalEn(
      `(() => document.readyState !== "loading" && document.body.innerText.length > 200)()`,
    );
    if (crudo === "true") {
      await dormir(400);
      return;
    }
    await dormir(500);
  }
  throw new Error(`la pagina no termino de cargar: ${await evalEn("(() => location.href)()")}`);
}

// 1. Ficha: un solo botón "Comprar", sin "Comprar ahora".
const tab = JSON.parse(orca(["tab", "create", "--url", `${base}/producto/${PRODUCTO}`, "--json"]));
page = tab.browserPageId ?? tab.result?.browserPageId;
await esperarListo();

// Un solo botón "Comprar": el de la barra móvil está oculto en desktop y cuenta
// aparte, así que solo se listan los visibles.
const botones = JSON.parse(
  evalEn(`JSON.stringify([...document.querySelectorAll("button, a")].filter((b) => {
    const r = b.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }).map((b) => (b.innerText || "").replace(/\\s+/g, " ").trim()).filter((t) => /Comprar|Agregar al carrito/.test(t)))`),
);
chequeo("la ficha tiene botón Comprar", botones.includes("Comprar"), botones.join(" / ") || "ninguno");
chequeo("la ficha NO tiene 'Comprar ahora'", !botones.includes("Comprar ahora"));
chequeo("la ficha NO manda al checkout directo", !botones.some((b) => /Comprar ahora/.test(b)));

// 2. Comprar lleva al carrito.
chequeo("el clic en Comprar funciona", evalEn(CLICK_EXACTO("Comprar")) === "ok");
await dormir(1200);
await esperarListo();
let estado = JSON.parse(evalEn(ESTADO));
chequeo("Comprar lleva al carrito", estado.url.startsWith("/carrito"), estado.url);

// 3. El carrito lleva al checkout.
chequeo("el carrito ofrece 'Ir a finalizar la compra'", evalEn(CLICK_EXACTO("Ir a finalizar la compra →")) === "ok");
await dormir(1200);
await esperarListo();
estado = JSON.parse(evalEn(ESTADO));
chequeo("el carrito lleva al checkout", estado.url.startsWith("/checkout"), estado.url);

// 4. El checkout es una sola página con el medio de pago a la vista.
chequeo("el checkout no es un wizard", estado.pasos === "sin wizard", estado.pasos);
chequeo("muestra 'Tu pedido'", estado.titulos.some((t) => t.includes("Tu pedido")), estado.titulos.join(" | "));
chequeo("muestra 'Medio de pago'", estado.titulos.some((t) => t.includes("Medio de pago")));
chequeo("muestra 'Detalles de facturación'", estado.titulos.some((t) => t.includes("facturación")));
chequeo("el medio de pago es visible sin avanzar", estado.pagos.length >= 3, estado.pagos.join(" · "));
chequeo("no hay desborde horizontal", !estado.desborda);

const fallas = resultados.filter((r) => !r.ok).length;
console.log(`\n[flujo] ${resultados.length - fallas}/${resultados.length} OK`);
process.exit(fallas ? 1 : 0);
