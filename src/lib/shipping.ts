import { etaLabel, FREE_SHIPPING_THRESHOLD } from "@/lib/format";

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

/**
 * Zonas de envío, en **pesos enteros** (misma escala que `products.price`).
 *
 * PENDIENTE DE CONFIRMAR CON EL DUEÑO — estos números NO son del sitio original.
 *
 * Intenté leerlos del checkout real de WooCommerce y no se puede: el sitio
 * original calcula el envío con un plugin de Andreani y muestra una tarifa que
 * no cambia con el destino. Medí 11 códigos postales distintos (Córdoba Capital,
 * CABA, Rosario, Mendoza, Mar del Plata, Río Gallegos) y todos dieron lo mismo:
 * $18.264 estándar / $18.044 sucursal. Además, la captura del propio cliente
 * taken antes mostraba $10.850 para Comodoro Rivadavia, o sea que el número se
 * actualiza sin aviso.
 *
 * O sea: la tabla real de Andreani es por PESO y única, no por zona. La de acá
 * es una aproximación razonable para mostrar el flujo, y hay que reemplazarla
 * con la tarifa del dueño antes de cobrar. Todo queda en este archivo.
 */
const ZONES: { name: string; test: (zip: string) => boolean; cost: number; min: number; max: number }[] = [
  { name: "Córdoba Capital", test: (z) => /^50[0-1]\d$/.test(z), cost: 4_900, min: 1, max: 2 },
  { name: "Interior de Córdoba", test: (z) => /^5\d{3}$/.test(z), cost: 6_900, min: 2, max: 3 },
  { name: "Centro y Litoral", test: (z) => /^[1-3]\d{3}$/.test(z), cost: 8_900, min: 3, max: 5 },
  { name: "Cuyo y NOA", test: (z) => /^[47]\d{3}$/.test(z), cost: 10_900, min: 4, max: 6 },
  { name: "Patagonia", test: (z) => /^[689]\d{3}$/.test(z), cost: 13_900, min: 5, max: 8 },
];

export function normalizeZip(input: string): string {
  const digits = (input || "").toUpperCase().replace(/[^0-9]/g, "");
  return digits.slice(0, 4);
}

export function zoneForZip(zip: string) {
  const normalized = normalizeZip(zip);
  if (normalized.length !== 4) return null;
  const zone = ZONES.find((z) => z.test(normalized));
  return zone ? { ...zone, zip: normalized } : null;
}

export function shippingOptions(zip: string, subtotal: number): ShippingOption[] {
  const zone = zoneForZip(zip);
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

  const freeStandard = subtotal >= FREE_SHIPPING_THRESHOLD;
  options.push({
    id: "standard",
    label: `Andreani (estándar) · ${zone.name}`,
    description: "Envío a domicilio con seguimiento online",
    eta: etaLabel(zone.min, zone.max),
    cost: freeStandard ? 0 : zone.cost,
    free: freeStandard,
    badge: freeStandard ? "Envío gratis" : undefined,
  });

  // El original ofrece exactamente dos servicios de Andreani: "estándar" a
  // domicilio y "sucursal" (retiro en la sucursal del correo). Antes el segundo
  // era una moto propia en Córdoba, que el original no tiene.
  options.push({
    id: "express",
    label: "Andreani (sucursal)",
    description: "Retirás en la sucursal de Andreani más cercana",
    eta: etaLabel(zone.min, zone.max + 1),
    cost: freeStandard ? 0 : Math.round(zone.cost * 0.95),
    free: freeStandard,
  });

  return options;
}

export function findShippingOption(zip: string, subtotal: number, id: DeliveryMethod): ShippingOption | null {
  return shippingOptions(zip, subtotal).find((option) => option.id === id) ?? null;
}
