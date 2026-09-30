/**
 * Verifica el menú de categorías del escritorio.
 *
 * El panel pasó de volcar el árbol entero (21 raíces + 83 subcategorías + 24
 * nietos = 128 links de una vez, siempre con scroll y con la última categoría
 * cortada) a dos niveles: las áreas a la izquierda y las subcategorías del área
 * señalada a la derecha. Este script comprueba que ese cambio siga en pie y que
 * no se pueda volver al muro de links sin que falle.
 *
 * Uso: npm run verificar:menu -- <baseUrl>
 */
import { execFileSync } from "node:child_process";

const base = process.argv[2] || "http://localhost:3000";
const orca = (a) => execFileSync("orca", a, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Cuántas áreas tiene el árbol: son las filas de la columna izquierda. */
const AREAS = 21;
/**
 * El techo de links que puede verse a la vez.
 *
 * Sale de medir el área más poblada, que es la que manda: Computación tiene 20
 * subcategorías y 13 nietos repartidos, así que el detalle dibuja 21 áreas + el
 * botón del encabezado + 20 subcategorías + los nietos que entran (4 por
 * subcategoría, más el "+N más" de las que sobran) = 49. El árbol entero son 128,
 * así que el peor caso es menos de la mitad de lo que se veía antes.
 *
 * Medido con scripts/tmp-links-menu.ts sobre la base, no estimado.
 */
const MAXIMO_LINKS = 49;
/** Links del árbol completo, el número al que se había vuelto el panel. */
const LINKS_DEL_ARBOL = 128;

let page = null;
const evalEn = (expr) => {
  const raw = JSON.parse(orca(["eval", "--page", page, "--expression", expr, "--json"]));
  if (!raw.ok) throw new Error(raw.error?.message ?? "fallo el eval");
  return raw.result.result;
};
const leer = (expr) => JSON.parse(evalEn(expr));

/**
 * Espera a que la página esté de verdad lista antes de mirarla.
 *
 * Con un `sleep` fijo el chequeo arranca a leer el DOM mientras todavía se está
 * armando y falla sin que haya nada roto. No se espera `readyState === "complete"`
 * porque en estas páginas nunca llega: el widget de WhatsApp deja conexiones
 * abiertas y el documento se queda en "interactive". Alcanza con que haya
 * terminado de parsear y haya texto en pantalla.
 *
 * `evalEn` devuelve el string crudo de la expresión, no el valor, así que el
 * resultado se compara contra "true": hacerlo contra el booleano `true` da falso
 * siempre y el chequeo termina en timeout aunque la página esté cargada.
 */
async function esperarListo(intentos = 40) {
  for (let i = 0; i < intentos; i += 1) {
    if (evalEn(`(() => document.readyState !== "loading" && document.body.innerText.length > 200)()`) === "true") {
      await dormir(400);
      return;
    }
    await dormir(500);
  }
  throw new Error(`la pagina no termino de cargar: ${evalEn("(() => location.href)()")}`);
}

/** Abre el panel del ícono de catálogo y devuelve el estado del menú. */
const ABRIR = `(() => {
  const t = document.querySelector('button[aria-label="Ver todas las categorías"]');
  if (!t) return JSON.stringify({ error: "no esta el boton de categorias" });
  t.click();
  return "ok";
})()`;

/** Foto del panel: las dos columnas, sus scrolls y cuántos links hay. */
const ESTADO = `(() => {
  const panel = document.querySelector('[role="group"][aria-labelledby]');
  if (!panel) return JSON.stringify({ abierto: false });
  // El panel es una grilla de dos columnas: la <ul> de áreas y el detalle. Se
  // toman los hijos directos y no un descendiente del <h3>, porque el encabezado
  // del detalle está dentro de la columna y no es la columna.
  const lista = panel.children[0] ?? null;
  const detalle = panel.children[1] ?? null;
  const h3 = panel.querySelector("h3");
  const estilo = (el) => (el ? getComputedStyle(el).overflowY : null);
  return JSON.stringify({
    abierto: true,
    shellOverflow: getComputedStyle(panel).overflowY,
    areas: [...(lista ? lista.querySelectorAll("a[data-area]") : [])].map((a) => ({
      area: a.getAttribute("data-area"),
      texto: (a.innerText || "").replace(/\\s+/g, " ").trim(),
      href: a.getAttribute("href"),
      actual: a.getAttribute("aria-current") === "true",
    })),
    listaOverflow: estilo(lista),
    listaScroll: lista ? { alto: lista.clientHeight, contenido: lista.scrollHeight } : null,
    detalleOverflow: estilo(detalle),
    titulo: h3 ? (h3.innerText || "").trim() : null,
    resumen: (() => {
      if (!h3) return null;
      const p = h3.parentElement.querySelector("p");
      return p ? (p.innerText || "").replace(/\\s+/g, " ").trim() : null;
    })(),
    detalleTexto: detalle ? (detalle.innerText || "").replace(/\\s+/g, " ").trim() : null,
    detalleEnlaces: detalle ? [...detalle.querySelectorAll("a")].map((a) => a.getAttribute("href")) : [],
    totalLinks: panel.querySelectorAll("a").length,
    desborda: document.documentElement.scrollWidth > innerWidth + 1,
    viewport: innerWidth,
  });
})()`;

/**
 * Señala un área como si el puntero entrara por ella.
 *
 * Dos detalles que no son obvios:
 *
 * - Va `mouseover` y no `mouseenter`: React no escucha el `mouseenter` nativo,
 *   arma su `onMouseEnter` a partir de `mouseover` comparando el relatedTarget
 *   con el nodo desde el que se entra.
 *
 * - El `relatedTarget` va en `null`, no en `document.body`. Con `document.body`
 *   React lo calcula como un nodo que ya estaba dentro del root, no ve ninguna
 *   transición de entrada y `onMouseEnter` no se dispara: el evento sale con
 *   `dispatchEvent` y la selección no se mueve.
 */
const SELECCIONAR = (slug) => `(() => {
  const a = document.querySelector('a[data-area="${slug}"]');
  if (!a) return JSON.stringify({ error: "no existe el area" });
  a.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, relatedTarget: null }));
  return JSON.stringify({ ok: true });
})()`;

/**
 * Enfoca un área por teclado.
 *
 * No se usa `element.focus()` solo porque la pestaña del navegador embebido no es
 * la ventana activa (`document.hasFocus()` da false) y Chrome no dispara
 * `focusin` cuando el foco se pide sobre una pestaña sin foco: `focus()` mueve
 * `activeElement` pero React nunca se entera. Se despacha el `focusin` a mano,
 * que es lo mismo que recibe el resto del tiempo.
 */
const ENFOCAR = (slug) => `(() => {
  const a = document.querySelector('a[data-area="${slug}"]');
  if (!a) return JSON.stringify({ error: "no existe el area" });
  a.focus();
  a.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
  return JSON.stringify({ ok: true, activo: document.activeElement.getAttribute("data-area") });
})()`;

/**
 * Mueve el foco con la flecha y dice dónde quedó.
 *
 * Después del `keydown` se despacha el `focusin` del elemento que quedó activo,
 * porque en una pestaña sin foco del sistema el navegador tampoco dispara el
 * `focusin` del elemento nuevo: `focus()` mueve `activeElement` y nada más. Es
 * lo que hace el Chrome real cuando tabulás, así que sin esto el chequeo
 * mediría el `keydown` pero no la selección que depende de él.
 */
const FLECHA = (tecla) => `(() => {
  const lista = document.querySelector('ul[aria-label="Áreas del catálogo"]');
  if (!lista) return JSON.stringify({ error: "no esta la lista" });
  const activo = document.activeElement;
  lista.dispatchEvent(new KeyboardEvent("keydown", { key: ${JSON.stringify(tecla)}, bubbles: true }));
  const ahora = document.activeElement;
  if (ahora && ahora !== activo) ahora.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
  return JSON.stringify({
    antes: activo ? activo.getAttribute("data-area") : null,
    despues: ahora ? ahora.getAttribute("data-area") : null,
  });
})()`;

const CERRADO = `(() => JSON.stringify({ abierto: Boolean(document.querySelector('[role="group"][aria-labelledby]')) }))()`;

let fallas = 0;
const chequeo = (nombre, ok, detalle) => {
  if (!ok) fallas += 1;
  console.log(`  ${ok ? "OK   " : "FALLA"} ${nombre}${detalle ? ` · ${detalle}` : ""}`);
};

console.log(`\nmenú de categorías contra ${base}\n`);

const tab = JSON.parse(orca(["tab", "create", "--url", `${base}/`, "--json"]));
page = tab.result?.browserPageId ?? tab.browserPageId;
if (!page) throw new Error("no se pudo abrir la pagina");
await esperarListo();

// El panel solo existe de lg en adelante; la barra es `hidden lg:block`.
chequeo("se abre el panel del catálogo", evalEn(ABRIR) === "ok");
await dormir(900);

const r = leer(ESTADO);
chequeo("el panel está abierto", r.abierto === true, r.error ?? "");
if (!r.abierto) {
  console.log(`\n[menu] ${fallas} falla(s)\n`);
  process.exit(1);
}

chequeo(`lista las ${AREAS} áreas`, r.areas.length === AREAS, `${r.areas.length} áreas`);
chequeo("cada área es enlace a su categoría", r.areas.every((a) => a.href?.startsWith("/categoria/")), `${r.areas.filter((a) => !a.href?.startsWith("/categoria/")).length} sin enlace`);
chequeo("exactamente una área queda marcada", r.areas.filter((a) => a.actual).length === 1, r.areas.find((a) => a.actual)?.area);

// Éste es el corazón del rediseño: dos columnas que scrollean por separado.
chequeo("el marco del panel no scrollea", r.shellOverflow === "hidden", `overflow-y: ${r.shellOverflow}`);
chequeo("la columna de áreas scrollea sola", r.listaOverflow === "auto", `overflow-y: ${r.listaOverflow}`);
chequeo("la columna de detalle scrollea sola", r.detalleOverflow === "auto", `overflow-y: ${r.detalleOverflow}`);
chequeo(
  "la lista de áreas es más larga que su caja",
  r.listaScroll && r.listaScroll.contenido > r.listaScroll.alto,
  r.listaScroll ? `${r.listaScroll.contenido}px de contenido en ${r.listaScroll.alto}px visibles` : "sin datos",
);

// Guarda contra la regresión al muro de links.
chequeo(`el panel no supera los ${MAXIMO_LINKS} links`, r.totalLinks <= MAXIMO_LINKS, `${r.totalLinks} links`);
chequeo("el panel no muestra el árbol entero", r.totalLinks < LINKS_DEL_ARBOL, `${r.totalLinks} de ${LINKS_DEL_ARBOL}`);

// El detalle tiene que mostrar los hijos del área elegida, no otra cosa.
chequeo("el detalle nombra al área elegida", Boolean(r.titulo), r.titulo ?? "vacío");
chequeo("el detalle da el conteo real", /\d+ productos/.test(r.resumen ?? ""), r.resumen ?? "sin resumen");
chequeo("el detalle ofrece la página del área", r.detalleEnlaces.some((h) => h?.startsWith("/categoria/")), `${r.detalleEnlaces.length} enlaces`);
chequeo("el panel no desborda", !r.desborda, `${r.viewport}px de viewport`);

// Señalar otra área por hover tiene que cambiar el detalle. Se elige una que no
// sea la ya seleccionada: el panel abre en la primera, y "volver a elegir la
// misma" daría un falso OK.
const inicial = r.areas.find((a) => a.actual)?.area;
const objetivo = r.areas.find((a) => a.area !== inicial);
leer(SELECCIONAR(objetivo.area));
await dormir(700);
const r2 = leer(ESTADO);
chequeo("al señalar otra área cambia el detalle", r2.titulo !== r.titulo, `${r.titulo} -> ${r2.titulo}`);
chequeo("el área señalada queda marcada", r2.areas.filter((a) => a.actual).length === 1 && r2.areas.find((a) => a.actual)?.area === objetivo.area, r2.areas.find((a) => a.actual)?.area);
chequeo("el nuevo detalle da su propio conteo", /\d+ productos/.test(r2.resumen ?? ""), r2.resumen ?? "sin resumen");

// Un área hoja no puede dejar un cuadro vacío al lado. Doce de las veintiuna lo
// son, así que es un camino muy transitado, no un caso raro.
const hoja = r2.areas.find((a) => /drones|juguetes|muebles|mochilas|calefaccion/i.test(a.texto));
if (hoja) {
  leer(SELECCIONAR(hoja.area));
  await dormir(700);
  const r3 = leer(ESTADO);
  const texto = r3.detalleTexto ?? "";
  chequeo(
    "un área sin subcategorías explica qué hay en vez de quedar vacía",
    /no tiene subcategorías/i.test(texto) || /No hay productos/i.test(texto),
    texto.slice(0, 90) || "vacío",
  );
  chequeo(
    "el área sin subcategorías no muestra una lista de hijos",
    !/Memoria RAM|Gabinetes|Motherboards/.test(texto),
    texto.slice(0, 90),
  );
} else {
  chequeo("se encontró un área sin subcategorías para probar", false, "ninguna de las 21 áreas es hoja");
}

// Con 21 áreas, tabular una por una para ver los hijos es inviable: la flecha
// tiene que mover el foco Y cambiar el detalle, porque el foco es lo que
// selecciona. Se miden las dos cosas.
const antes = leer(ESTADO);
leer(ENFOCAR(antes.areas[0].area));
await dormir(600);
const f = leer(FLECHA("ArrowDown"));
await dormir(700);
const rf = leer(ESTADO);
chequeo("la flecha abajo mueve el foco entre áreas", Boolean(f.despues) && f.despues !== f.antes, `${f.antes} -> ${f.despues}`);
chequeo("el foco decide el área mostrada", rf.areas.find((a) => a.actual)?.area === f.despues, `${f.despues} / marcada ${rf.areas.find((a) => a.actual)?.area}`);
chequeo("el detalle acompaña al foco", rf.titulo !== antes.titulo || f.despues === antes.areas.find((a) => a.actual)?.area, `${antes.titulo} -> ${rf.titulo}`);

// Escape cierra el panel y es la salida para teclado.
evalEn(`(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); return "ok"; })()`);
await dormir(600);
chequeo("Escape cierra el panel", leer(CERRADO).abierto === false);

console.log(`\n[menu] ${fallas === 0 ? "todo OK" : `${fallas} falla(s)`}\n`);
process.exit(fallas ? 1 : 0);
