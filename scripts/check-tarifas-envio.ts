/**
 * Gate de las tarifas de envio.
 *
 * Comprueba dos cosas:
 *  1. Que los precios por zona de `PRECIO_POR_ZONA` esten ordenados (la zona
 *     mas cara nunca puede salir mas barata que la general).
 *  2. Que `zonaParaCp` devuelva la zona real para los 36 codigos que se leyeron
 *     uno por uno del calculador del sitio original. Si alguien toca la tabla
 *     por prefijo y rompe un codigo verificado, esto falla.
 *
 * Lo que NO puede comprobar todavia es la tarifa por peso volumetrico: falta
 * el peso real de los productos (ver el comentario de `tarifas-envio.ts`).
 */
import {
  CP_VERIFICADOS,
  ESCALONES_POR_UNIDADES,
  NOMBRE_ZONA,
  PRECIO_POR_ZONA,
  ZONA_POR_PREFIJO,
  zonaParaCp,
  type ServicioEnvio,
  type ZonaEnvio,
} from "../src/lib/tarifas-envio";
import { shippingOptions, zoneForZip } from "../src/lib/shipping";

const servicios: ServicioEnvio[] = ["sucursal", "estandar"];
const orden: ZonaEnvio[] = ["local", "general", "norte", "caribe"];

let fallos = 0;
const falla = (msg: string) => {
  console.error(`  FALLA: ${msg}`);
  fallos++;
};

console.log("1) precios ordenados por zona");
for (const s of servicios) {
  const precios = orden.map((z) => PRECIO_POR_ZONA[z][s]);
  for (let i = 1; i < precios.length; i++) {
    if (precios[i] <= precios[i - 1])
      falla(`${s}: ${orden[i]} (${precios[i]}) no supera a ${orden[i - 1]} (${precios[i - 1]})`);
  }
  const ventana = precios.join(" < ");
  const ok = precios.every((p) => p > 0);
  console.log(`   ${ok ? "ok " : "?? "}${s.padEnd(9)} ${ventana}`);
}

console.log("\n2) el Escalon mas bajo coincide con el precio por zona");
for (const e of ESCALONES_POR_UNIDADES) {
  if (e.unidades !== 1) continue;
  for (const z of orden)
    for (const s of servicios)
      if (e.precios[z][s] !== PRECIO_POR_ZONA[z][s])
        falla(`escalon 1 unidad desincronizado de PRECIO_POR_ZONA en ${z}/${s}`);
  console.log("   ok  escalon 1 == PRECIO_POR_ZONA en las 4 zonas y los 2 servicios");
}

console.log(`\n3) los ${CP_VERIFICADOS.length} codigos verificados dan la zona real`);
let ok = 0;
for (const { cp, lugar, zona } of CP_VERIFICADOS) {
  const obtenida = zonaParaCp(cp);
  if (obtenida !== zona) falla(`cp ${cp} (${lugar}) devolvio ${obtenida}, el calculador dio ${zona}`);
  else ok++;
}
console.log(`   ${ok}/${CP_VERIFICADOS.length} correctos`);

console.log("\n4) ningun CP verificado se resuelve solo por prefijo (o si, a proposito)");
const prefijoVsExacto = CP_VERIFICADOS.filter(
  ({ cp, zona }) => ZONA_POR_PREFIJO[cp.slice(0, 2)] !== zona,
);
if (prefijoVsExacto.length === 0) {
  console.log("   la tabla por prefijo alcanza para todos los codigos verificados");
} else {
  console.log(`   ${prefijoVsExacto.length} codigo(s) dependen del caso exacto:`);
  for (const c of prefijoVsExacto)
    console.log(`     cp ${c.cp} (${c.lugar}): exacto=${c.zona} prefijo=${ZONA_POR_PREFIJO[c.cp.slice(0, 2)]}`);
}

console.log("\n5) cp desconocido cae en la zona general, sin romper");
for (const cp of ["0000", "1234", "5678", "9999", "", "abc"]) {
  const z = zonaParaCp(cp);
  if (!NOMBRE_ZONA[z]) falla(`cp "${cp}" devolvio una zona desconocida`);
}
console.log(`   ok  sin cp raro revienta (${["0000", "1234", "5678", "9999", "", "abc"].map((c) => `${c}->${zonaParaCp(c)}`).join(", ")})`);

// ---------------------------------------------------------------- shippingOptions
// Los valores esperados son los que devolvio el calculador del sitio original
// para el teclado Logitech MK235 con cantidad 1.
console.log("\n6) shippingOptions devuelve la tarifa real, servicio por servicio");
// OJO: los ids internos siguen llamandose "standard" y "express" por
// compatibilidad (ver la deuda tecnica en `shipping.ts`). "standard" es
// Andreani a domicilio y "express" es Andreani a sucursal.
const ESPERADO: [string, string, number, number][] = [
  // cp, zona, estandar, sucursal
  ["5000", "Cordoba Capital", 8331.43, 5555.74],
  ["8000", "Interior del pais", 9407.7, 7572.56],
  ["9100", "Sur y Patagonia", 10850.28, 8896.18],
  ["4400", "Norte", 10277.33, 8250.01],
  ["3300", "Sur y Patagonia", 10850.28, 8896.18],
  ["5300", "Interior del pais", 9407.7, 7572.56],
];

for (const [cp, zonaEsperada, estandar, sucursal] of ESPERADO) {
  const z = zoneForZip(cp);
  if (!z) {
    falla(`cp ${cp} no devolvio zona`);
    continue;
  }
  if (z.name !== zonaEsperada) falla(`cp ${cp} dio zona "${z.name}", se esperaba "${zonaEsperada}"`);

  const opts = shippingOptions(cp, 0);
  const est = opts.find((o) => o.id === "standard");
  const suc = opts.find((o) => o.id === "express");
  const pick = opts.find((o) => o.id === "pickup");

  if (!est) falla(`cp ${cp}: falta el servicio a domicilio`);
  if (!suc) falla(`cp ${cp}: falta el servicio a sucursal`);
  if (!pick) falla(`cp ${cp}: falta el retiro en el local`);
  if (pick && pick.cost !== 0) falla(`cp ${cp}: el retiro en el local deberia ser gratis`);

  if (est && Math.abs(est.cost - estandar) > 0.01)
    falla(`cp ${cp}: a domicilio ${est.cost}, el original cobra ${estandar}`);
  if (suc && Math.abs(suc.cost - sucursal) > 0.01)
    falla(`cp ${cp}: a sucursal ${suc.cost}, el original cobra ${sucursal}`);

  // La sucursal tiene que salir siempre mas barata que el envio a domicilio.
  if (suc && est && suc.cost >= est.cost)
    falla(`cp ${cp}: a sucursal (${suc.cost}) no es mas barato que a domicilio (${est.cost})`);

  // Las etiquetas tienen que decir Andreani, no "moto" ni "express".
  for (const o of [est, suc])
    if (o && !/Andreani/.test(o.label)) falla(`cp ${cp}: la etiqueta "${o.label}" no menciona Andreani`);

  console.log(
    `   ok  cp ${cp.padEnd(4)} ${zonaEsperada.padEnd(19)} domi $${String(est?.cost ?? "-").padEnd(9)} suc $${suc?.cost ?? "-"}`,
  );
}

console.log("\n7) sin CP no se ofrecen envios, solo el retiro en el local");
for (const cp of ["", "123", "abcde"]) {
  const opts = shippingOptions(cp, 0);
  if (opts.length !== 1 || opts[0].id !== "pickup")
    falla(`cp "${cp}" ofrecio ${opts.length} opciones en vez de solo el retiro`);
}
console.log("   ok  cp incompleto no inventa un precio de envío");

console.log(
  fallos ? `\n${fallos} FALLA(S)` : "\nOK: las tarifas coinciden con el calculador del sitio original.",
);
process.exit(fallos ? 1 : 0);
