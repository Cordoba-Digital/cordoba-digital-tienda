import { NOMBRE_ZONA, PRECIO_POR_ZONA, zonaParaCp, type ZonaEnvio } from "@/lib/tarifas-envio";

/**
 * Metodos de entrega: retirar en el local, o los dos servicios de Andreani.
 *
 * DEUDA TECNICA: los ids se llaman "standard" y "express", pero "express"
 * significa "Andreani a sucursal" y "standard" significa "Andreani a
 * domicilio". Los nombres quedaron viejos de cuando "express" era una moto
 * propia que el local no tiene. Habria que renombrarlos a "estandar" y
 * "sucursal", pero eso obliga a tocar `api/checkout/route.ts` y
 * `checkout-flow.tsx`, que en este momento tienen otro trabajo a medio
 * commitear. Se renombra en cuanto el arbol quede limpio.
 *
 * Los precios y las zonas salen de `tarifas-envio.ts`, que se leyo del
 * calculador del sitio original (ver `docs/TARIFAS-ENVIO.md`).
 */
export type DeliveryMethod = "pickup" | "standard" | "express";

export type ShippingOption = {
  id: DeliveryMethod;
  label: string;
  description: string;
  eta: string;
  cost: number;
  free: boolean;
  badge?: string;
};

/** Plazos que declara el local en la ficha de producto ("1-3 dias habiles"). */
const PLAZO_DOMICILIO = "Llega entre 1 y 3 días hábiles";
const PLAZO_SUCURSAL = "El local te confirma la sucursal y el plazo";

export function normalizeZip(input: string): string {
  const digits = (input || "").toUpperCase().replace(/[^0-9]/g, "");
  return digits.slice(0, 4);
}

/**
 * Zona de un codigo postal, con el nombre que se muestra al cliente.
 *
 * Las cuatro zonas no siguen geografia: Posadas (3300) es la mas cara del pais
 * y Obera, a 300 km (6000), es la general; Bariloche (8400) es "norte" pero
 * Neuquen (8000) es "general". Por eso se resuelve con la tabla de `tarifas-
 * envio.ts`, que reproduce los 35 codigos verificados del calculador.
 */
export function zoneForZip(zip: string): { zona: ZonaEnvio; name: string; zip: string } | null {
  const normalized = normalizeZip(zip);
  if (normalized.length !== 4) return null;
  const zona = zonaParaCp(normalized);
  return { zona, name: NOMBRE_ZONA[zona], zip: normalized };
}

export function shippingOptions(zip: string): ShippingOption[] {
  const zone = zoneForZip(zip);

  // El unico envio sin cargo es el retiro en el local. No hay umbral por monto:
  // el sitio original no anuncia envio gratis en ningun lado y los 2.589
  // productos tienen `free_shipping = false`.
  const options: ShippingOption[] = [
    {
      id: "pickup",
      label: "Retiro en el local",
      description: "27 de Abril 259, Córdoba Capital · Lun a Vie 14 a 18:30, Sáb 11 a 14",
      eta: "Listo en 2 horas hábiles",
      cost: 0,
      free: true,
      badge: "Gratis",
    },
  ];

  if (!zone) return options;

  // Los dos servicios de Andreani, al precio real de la zona. "Sucursal"
  // (retirar en la sucursal del correo) sale entre 25% y 35% menos que el
  // estandar a domicilio, y antes el sitio no lo ofrecia en ninguna pagina.
  //
  // OJO: estos precios son los del paquete mas chico. La tarifa de Andreani
  // sube por PESO VOLUMETRICO (probado: dos valijas de 2,4 kg y de 5 kg cobran
  // lo mismo, y el precio sube con el volumen, r = 0.996). Falta traer el peso
  // y las medidas reales de cada producto, que hoy no tenemos en la base. Para
  // los productos grandes el precio queda subestimado (ver
  // `docs/TARIFAS-ENVIO.md`).
  const tarifa = PRECIO_POR_ZONA[zone.zona];

  options.push({
    id: "standard",
    label: `Andreani (estándar) · ${zone.name}`,
    description: "Envío a domicilio con seguimiento online",
    eta: PLAZO_DOMICILIO,
    cost: tarifa.estandar,
    free: false,
  });

  // Id "express" por compatibilidad con el resto del codigo; el servicio es
  // retirar en la sucursal de Andreani, no un envio express.
  options.push({
    id: "express",
    label: `Andreani (sucursal) · ${zone.name}`,
    description: "Retirás en la sucursal de Andreani más cercana",
    eta: PLAZO_SUCURSAL,
    cost: tarifa.sucursal,
    free: false,
  });

  return options;
}

export function findShippingOption(zip: string, id: DeliveryMethod): ShippingOption | null {
  return shippingOptions(zip).find((option) => option.id === id) ?? null;
}
