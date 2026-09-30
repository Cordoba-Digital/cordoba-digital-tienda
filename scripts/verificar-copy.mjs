/**
 * Verifica que no queden afirmaciones inventadas en las páginas públicas.
 *
 * El sitio se migró de WooCommerce y hay que copiarlo tal cual: el copy de la
 * home, del checkout, de la ficha de producto y del centro de ayuda tiene que
 * salir de datos reales del sitio original, no de suposiciones. Esta lista es la
 * de las afirmaciones que se sacaron por no existir en el original, y sirve de alarma
 * para que no vuelvan.
 *
 * Revisa el HTML completo, no solo el texto visible. Antes miraba únicamente
 * `document.body.innerText`, y por eso se le colaron dos afirmaciones en el
 * `<head>`: la descripción de /productos seguía anunciando el 15% OFF con
 * transferencia que ya se había sacado del sitio, y Google la muestra en los
 * resultados igual que el texto de la página.
 *
 * También revisa `<title>`, `meta[name=keywords]`, las etiquetas de Open Graph y
 * los JSON-LD, porque los buscadores leen tanto o más el head que el cuerpo.
 *
 * Un HTML vacío o una página que no carga se reporta como FALLA, no como
 * limpio: antes una página caída daba "0 caracteres revisados" y pasaba el
 * control, que es un falso verde.
 *
 * Uso: node scripts/verificar-copy.mjs <baseUrl>
 */
const base = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");

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
  // La dirección se imprime en 20 lugares y estuvo mal en todos: el original la
  // publica en el pie de la home y en /contacto/ como "27 de abril 180". El
  // 259 que se imprimía no está en el sitio viejo; el 259 que aparece ahí es
  // parte de precios (1.259.999, 259.999).
  ["Abril 259", "la dirección real es 27 de abril 180 (pie y /contacto del original)"],
  ["Abril+259", "idem, en el link de Google Maps"],
  ["Sáb 11 a 14", "el horario real del sábado es de 12 a 14:30"],
  ["11 a 14:30", "idem"],
  // El original no publica código postal en ninguna parte.
  ['"postalCode"', "el original no publica código postal"],
  // Cuotas: se buscó "cuota", "financia" y "sin interés" en la home, /contacto/,
  // la ficha de producto y la política de garantía del original, y no hay una
  // sola coincidencia. Además los coeficientes (1,12 y 1,22) no salían de
  // ningún cálculo.
  ["cuota sin interés", "el original no ofrece cuotas ni financiación"],
  ["cuotas sin interés", "idem"],
  ["cuotas fijas", "idem"],
  ["Simulá tus cuotas", "idem, el simulador se sacó"],
  ["plan de cuotas", "idem, el selector del checkout se sacó"],
  ["interés de financiación", "idem, el interés era un número inventado"],
  ["48 horas", "no está en el original y es un compromiso operativo"],
  ["48 hs", "idem"],
  ["desde 2006", "el original no dice en qué año abrió el negocio"],
];

/**
 * Páginas a revisar. `/categoria/...` y `/producto/...` no entran acá porque sus
 * textos vienen del WooCommerce original, no de este código.
 */
const PAGINAS = [
  "/",
  "/productos",
  "/producto/iphone-18-pro-max-512gb",
  "/ayuda",
  "/carrito",
  "/checkout",
  "/favoritos",
  "/seguimiento",
  "/guias",
];

/** Mínimo de caracteres para considerar que la página realmente se leyó. */
const MINIMO = 2000;

const fallas = [];
let totalRevisado = 0;

console.log(`copy sin inventos contra ${base}\n`);

for (const ruta of PAGINAS) {
  let html = "";
  let estado = 200;
  try {
    const res = await fetch(`${base}${ruta}`, {
      headers: { "User-Agent": "verificar-copy (chequeo interno)" },
    });
    estado = res.status;
    html = await res.text();
  } catch (e) {
    console.log(`  FALLA ${ruta}  no se pudo pedir la página: ${e.message}`);
    fallas.push(`${ruta}: no se pudo pedir`);
    continue;
  }

  if (estado !== 200) {
    console.log(`  FALLA ${ruta}  respondió ${estado}`);
    fallas.push(`${ruta}: HTTP ${estado}`);
    continue;
  }

  if (html.length < MINIMO) {
    console.log(
      `  FALLA ${ruta}  solo ${html.length} bytes (se esperaban ${MINIMO}): la página no llegó a renderizar, no se puede afirmar que esté limpia`,
    );
    fallas.push(`${ruta}: respuesta demasiado corta (${html.length} bytes)`);
    continue;
  }

  const plano = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();

  // El HTML entero, en minúsculas, para buscar también dentro de los atributos.
  const crudo = html.toLowerCase();

  // La aguja va en minúscula como el texto: si no, nunca encuentra nada.
  const malos = PROHIBIDO.filter(([aguja]) => {
    const n = aguja.toLowerCase();
    return plano.includes(n) || crudo.includes(n);
  });

  totalRevisado += plano.length;

  if (malos.length === 0) {
    console.log(`  OK   ${ruta}  (${plano.length} caracteres revisados, ${html.length} bytes)`);
  } else {
    console.log(`  FALLA ${ruta}  (${plano.length} caracteres revisados)`);
    for (const [aguja, motivo] of malos) {
      const enHead = crudo.indexOf(aguja) < crudo.indexOf("</head>");
      console.log(`        "${aguja}" — ${motivo}${enHead ? "  [en el <head>]" : ""}`);
      fallas.push(`${ruta}: ${aguja}`);
    }
  }
}

const limpias = PAGINAS.length - new Set(fallas.map((f) => f.split(":")[0])).size;
console.log(`\n[copy] ${limpias}/${PAGINAS.length} páginas limpias · ${totalRevisado} caracteres en total`);
process.exit(fallas.length ? 1 : 0);
