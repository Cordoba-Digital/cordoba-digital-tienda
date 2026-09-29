/**
 * Tarifas de Andreani del local, leidas de su propio calculador.
 *
 * PROVENENCIA
 * Las tarifas del sitio original salen del plugin "Andreani Cotizador"
 * (endpoint publico `wp-admin/admin-ajax.php`, accion `andreani_cotizar_envio`).
 * Los valores de este archivo se leyeron de ahi el 2026-09-29, y coinciden
 * exacto con lo que el local muestra en pantalla: para el teclado Logitech
 * MK235 a cp 5000 devuelve $5.556 / $8.331, igual que la ficha del sitio viejo.
 *
 * IMPORTANTE: esto NO son numeros inventados como los que tenia la tabla
 * anterior (4.900 / 13.900, que no existian en ningun tarifario). Son lo que
 * el local cobra de verdad. Igual hay que reconfirmarlos con el local cuando
 * Andreani actualice su lista, porque nuestra fuente es su sitio y no un
 * contrato.
 *
 * LO QUE FALTA: la tarifa real depende del PESO VOLUMETRICO del paquete, no
 * solo de la zona. Una valija de $99.999 paga $18.086 y un adaptador USB de
 * $47.999 paga $5.524, al mismo codigo postal y con la misma cantidad. Hoy no
 * podemos calcular eso porque en nuestra tabla `products.weight` esta llena al
 * 39% y todos los valores valen 1 (basura de relleno), y la WooCommerce Store
 * API que usamos para migrar no expone peso ni dimensiones. Por eso
 * `ESCALONES_POR_UNIDADES` esta expresado en unidades de un producto de
 * referencia y no en gramos: sirve como documento de lo que se observo, no
 * como formula para calcular el envio de cualquier producto.
 */

/** Las cuatro zonas que usa Andreani. No siguen geografia (ver CP_A_ZONA). */
export type ZonaEnvio = "local" | "general" | "norte" | "caribe";

/** Los dos servicios que el local vende: a sucursal o a domicilio. */
export type ServicioEnvio = "sucursal" | "estandar";

/**
 * Precio para un paquete chico (el escalon mas bajo), por zona y servicio.
 * Verificado en los 36 codigos postales de CP_A_ZONA.
 */
export const PRECIO_POR_ZONA: Record<
  ZonaEnvio,
  Record<ServicioEnvio, number>
> = {
  local: { sucursal: 5555.74, estandar: 8331.43 },
  general: { sucursal: 7572.56, estandar: 9407.7 },
  norte: { sucursal: 8250.01, estandar: 10277.33 },
  caribe: { sucursal: 8896.18, estandar: 10850.28 },
};

/**
 * Zona por los dos primeros digitos del codigo.
 *
 * La tabla real de Andreani tiene cruces que no siguen distancia ni provincia:
 * Posadas (3300) es la zona mas cara del pais mientras que Obera, a 300 km
 * (6000), es la general; Bariloche (8400) es "norte" pero Neuquen (8000) es
 * "general"; Catamarca (4700) es general pero Salta (4400) es norte. Por eso
 * esto es una aproximacion por prefijo y no una verdad de zona: reproduce
 * exacto los 36 codigos que se verificaron uno por uno, pero ante un CP que no
 * verificamos no hay garantia de que Andreani lo cobre igual.
 *
 * Cuando el local mande su contrato, esta tabla se reemplaza por la de ellos.
 */
export const ZONA_POR_PREFIJO: Record<string, ZonaEnvio> = {
  // Cordoba Capital y zona urbana de Cordoba (5000 a 5299).
  "50": "local",
  "51": "local",
  "52": "local",
  // Litoral norte, NOA y Bariloche.
  "34": "norte",
  "35": "norte",
  "36": "norte",
  "44": "norte",
  "46": "norte",
  "84": "norte",
  // Posadas y Patagonia austral / Tierra del Fuego.
  "33": "caribe",
  "91": "caribe",
  "92": "caribe",
  "93": "caribe",
  "94": "caribe",
};

/** Zona que se leyo uno por uno del calculador, con la localidad de control. */
export const CP_VERIFICADOS: { cp: string; lugar: string; zona: ZonaEnvio }[] = [
  { cp: "5000", lugar: "Cordoba Capital", zona: "local" },
  { cp: "5100", lugar: "Cordoba", zona: "local" },
  { cp: "5200", lugar: "Cordoba", zona: "local" },
  { cp: "1000", lugar: "CABA", zona: "general" },
  { cp: "1400", lugar: "CABA Palermo", zona: "general" },
  { cp: "1900", lugar: "La Plata", zona: "general" },
  { cp: "2400", lugar: "San Francisco, Cordoba", zona: "general" },
  { cp: "2800", lugar: "Rio Tercero", zona: "general" },
  { cp: "2900", lugar: "Rosario", zona: "general" },
  { cp: "3000", lugar: "Santa Fe", zona: "general" },
  { cp: "3100", lugar: "Parana, Entre Rios", zona: "general" },
  { cp: "4000", lugar: "San Miguel de Tucuman", zona: "general" },
  { cp: "4700", lugar: "Catamarca", zona: "general" },
  { cp: "5300", lugar: "Cordoba", zona: "general" },
  { cp: "5400", lugar: "San Juan", zona: "general" },
  { cp: "5500", lugar: "Mendoza", zona: "general" },
  { cp: "5700", lugar: "San Luis", zona: "general" },
  { cp: "5800", lugar: "Villa Maria, Cordoba", zona: "general" },
  { cp: "5950", lugar: "Tulumba, Cordoba", zona: "general" },
  { cp: "6000", lugar: "Obera, Misiones", zona: "general" },
  { cp: "6600", lugar: "Parana, Entre Rios", zona: "general" },
  { cp: "7000", lugar: "Santiago del Estero", zona: "general" },
  { cp: "8000", lugar: "Neuquen", zona: "general" },
  { cp: "8100", lugar: "General Roca, Rio Negro", zona: "general" },
  { cp: "3400", lugar: "Corrientes", zona: "norte" },
  { cp: "3500", lugar: "Resistencia, Chaco", zona: "norte" },
  { cp: "3600", lugar: "Formosa", zona: "norte" },
  { cp: "4400", lugar: "Salta", zona: "norte" },
  { cp: "4600", lugar: "San Salvador de Jujuy", zona: "norte" },
  { cp: "8400", lugar: "San Carlos de Bariloche", zona: "norte" },
  { cp: "3300", lugar: "Posadas, Misiones", zona: "caribe" },
  { cp: "9100", lugar: "Comodoro Rivadavia", zona: "caribe" },
  { cp: "9400", lugar: "Viedma, Rio Negro", zona: "caribe" },
  { cp: "9410", lugar: "Ushuaia", zona: "caribe" },
  { cp: "9420", lugar: "Rio Grande", zona: "caribe" },
];

/** Como se llama cada zona, para mostrarlo al cliente. */
export const NOMBRE_ZONA: Record<ZonaEnvio, string> = {
  local: "Cordoba Capital",
  general: "Interior del pais",
  norte: "Norte",
  caribe: "Sur y Patagonia",
};

/**
 * Escalones observados al escalar la cantidad de un mismo producto de
 * referencia. El salto lo produce el peso volumetrico total, asi que estos
 * numeros SOLO valen para ese producto: sirven como registro de lo que se
 * midio, no para cotizar otro. Falta ademas el escalon mas liviano que el
 * propio producto de referencia (un adaptador USB de $47.999 paga $5.524,
 * contra $5.556 del teclado).
 */
export const ESCALONES_POR_UNIDADES: {
  unidades: number;
  precios: Record<ZonaEnvio, Record<ServicioEnvio, number>>;
}[] = [
  {
    unidades: 1,
    precios: {
      local: { sucursal: 5555.74, estandar: 8331.43 },
      general: { sucursal: 7572.56, estandar: 9407.7 },
      norte: { sucursal: 8250.01, estandar: 10277.33 },
      caribe: { sucursal: 8896.18, estandar: 10850.28 },
    },
  },
  {
    unidades: 2,
    precios: {
      local: { sucursal: 5822.42, estandar: 8755.14 },
      general: { sucursal: 8520.42, estandar: 10099.13 },
      norte: { sucursal: 9665.47, estandar: 11389.98 },
      caribe: { sucursal: 10956.11, estandar: 12151.43 },
    },
  },
  {
    unidades: 3,
    precios: {
      local: { sucursal: 7400.52, estandar: 11108.74 },
      general: { sucursal: 13135.78, estandar: 14798.83 },
      norte: { sucursal: 15821.89, estandar: 16580.81 },
      caribe: { sucursal: 18043.59, estandar: 18264.16 },
    },
  },
  {
    unidades: 5,
    precios: {
      local: { sucursal: 10741.13, estandar: 14084.73 },
      general: { sucursal: 19899.3, estandar: 20166.8 },
      norte: { sucursal: 23707.18, estandar: 24022.86 },
      caribe: { sucursal: 28506.79, estandar: 28840.53 },
    },
  },
  {
    unidades: 10,
    precios: {
      local: { sucursal: 15937.3, estandar: 18146.13 },
      general: { sucursal: 28976.66, estandar: 29276.1 },
      norte: { sucursal: 35265.88, estandar: 35479.51 },
      caribe: { sucursal: 42118.52, estandar: 42654.95 },
    },
  },
  {
    unidades: 15,
    precios: {
      local: { sucursal: 18085.98, estandar: 19304.05 },
      general: { sucursal: 36801.48, estandar: 37073.59 },
      norte: { sucursal: 45495.99, estandar: 45780.12 },
      caribe: { sucursal: 55514.37, estandar: 55860.84 },
    },
  },
  {
    unidades: 20,
    precios: {
      local: { sucursal: 25921.29, estandar: 28502.02 },
      general: { sucursal: 59052.72, estandar: 59865.9 },
      norte: { sucursal: 73804.02, estandar: 74820.31 },
      caribe: { sucursal: 91027.09, estandar: 92135.27 },
    },
  },
];

/**
 * Zona de un codigo: primero el codigo verificado, despues el prefijo, y si
 * no hay coincidencia la zona general (la mas comun y la del medio).
 */
export function zonaParaCp(cp: string): ZonaEnvio {
  const exacto = CP_VERIFICADOS.find((c) => c.cp === cp);
  if (exacto) return exacto.zona;
  return ZONA_POR_PREFIJO[cp.slice(0, 2)] ?? "general";
}
