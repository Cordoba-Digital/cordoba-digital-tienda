/**
 * Contraste del tema oscuro.
 *
 * Los tonos se eligieron a ojo, asi que se miden: WCAG AA pide 4,5:1 para texto
 * normal y 3:1 para texto grande (18,66 px en negrita o 24 px) y para bordes que
 * son el unico indicador de un control.
 */
/**
 * `pending: true` marca pares que se conocen por debajo de AA y cuya correccion
 * es una decision de diseno (cambiar el naranja de los botones se nota). No
 * hacen fallar el chequeo, pero se imprimen igual para que no se pierdan.
 */
const PAIRS = [
  // --- Tema oscuro -------------------------------------------------------
  ["oscuro texto principal sobre pagina", "#f3f6fb", "#070c18", 4.5],
  ["oscuro texto principal sobre tarjeta", "#f3f6fb", "#101828", 4.5],
  ["oscuro texto secundario sobre pagina", "#94a3bd", "#070c18", 4.5],
  ["oscuro texto terciario sobre pagina", "#7b8caf", "#070c18", 4.5],
  ["oscuro texto terciario sobre tarjeta", "#7b8caf", "#101828", 4.5],
  ["oscuro enlace de marca sobre pagina", "#ffb185", "#070c18", 4.5],
  ["oscuro estado ok sobre su tinte", "#6ee7b7", "#06281c", 4.5],
  ["oscuro estado error sobre su tinte", "#fda4af", "#33111a", 4.5],
  ["oscuro estado aviso sobre su tinte", "#fcd34d", "#2e2005", 4.5],
  ["oscuro boton Ver mas (texto blanco)", "#ffffff", "#0a1226", 4.5],

  // --- Tema claro: se midio tambien para separar regresiones nuevas --------
  ["claro texto principal sobre pagina", "#0a1226", "#f5f7fb", 4.5],
  // Preexistente, no lo introdujo el modo oscuro: `ink-400` (#6b7fa6) se usa
  // para los textos terciarios (conteo de productos, "6 cuotas", metadatos) y
  // queda en 3,76:1 sobre el fondo de pagina. Se arregla oscureciendo un poco
  // el token, pero cambia el tono del tema claro ya revisado.
  ["claro texto terciario (ink-400) sobre pagina", "#6b7fa6", "#f5f7fb", 4.5],
  ["claro enlace de marca sobre pagina", "#c2410c", "#ffffff", 4.5],
  ["claro boton Ver mas (texto blanco)", "#ffffff", "#0a1226", 4.5],

  // --- Conocido por debajo de AA, en los dos temas ------------------------
  // El boton de accion principal es `bg-brand-600` con etiqueta blanca: 3,58:1
  // contra el 4,5:1 que pide AA. No es una regresion del modo oscuro, venia del
  // cambio de paleta. Subirlo a `brand-700` (#c2410c, 5,2:1) lo arregla, pero
  // oscurece el naranja de las 26 acciones primarias.
  ["boton de marca, tema claro", "#ffffff", "#e8590c", 4.5, true],
  ["boton de marca, tema oscuro", "#ffffff", "#e8590c", 4.5, true],

  // --- Decorativo: el borde de tarjeta no es texto ni indicador unico ------
  ["oscuro borde de tarjeta sobre tarjeta", "#182138", "#101828", 1, "decorativo"],
];

function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = srgbToLinear((n >> 16) & 255);
  const g = srgbToLinear((n >> 8) & 255);
  const b = srgbToLinear(n & 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

let fail = 0;
let pending = 0;
console.log("par                                     ratio   pedido  estado");
console.log("-".repeat(70));
for (const [label, fg, bg, min, note] of PAIRS) {
  const ratio = contrast(fg, bg);
  const isDecorative = note === "decorativo";
  const ok = ratio >= min;
  if (!ok && !isDecorative) {
    if (note === true) pending += 1;
    else fail += 1;
  }
  const estado = isDecorative ? "decorativo" : ok ? "ok" : note === true ? "PENDIENTE" : "FALLA";
  console.log(
    `${label.padEnd(40)} ${ratio.toFixed(2).padStart(5)}:1  ${String(min).padStart(6)}  ${estado}`,
  );
}

console.log("");
if (fail > 0) console.log(`${fail} PAR(ES) SIN CUMPLIR: regresion, hay que corregirlo.`);
if (pending > 0) console.log(`${pending} PAR(ES) PENDIENTES: bajo AA por decision de diseno, no bloquean.`);
if (fail === 0) console.log("Ninguna regresion de contraste.");
process.exit(fail === 0 ? 0 : 1);
