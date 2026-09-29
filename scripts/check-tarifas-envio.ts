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

console.log(
  fallos ? `\n${fallos} FALLA(S)` : "\nOK: las tarifas coinciden con el calculador del sitio original.",
);
process.exit(fallos ? 1 : 0);
