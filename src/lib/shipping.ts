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

const ZONES: { name: string; test: (zip: string) => boolean; cost: number; min: number; max: number }[] = [
  { name: "Córdoba Capital", test: (z) => /^50[0-1]\d$/.test(z), cost: 4_900_00, min: 1, max: 2 },
  { name: "Interior de Córdoba", test: (z) => /^5\d{3}$/.test(z), cost: 6_900_00, min: 2, max: 3 },
  { name: "Centro y Litoral", test: (z) => /^[1-3]\d{3}$/.test(z), cost: 8_900_00, min: 3, max: 5 },
  { name: "Cuyo y NOA", test: (z) => /^[47]\d{3}$/.test(z), cost: 10_900_00, min: 4, max: 6 },
  { name: "Patagonia", test: (z) => /^[689]\d{3}$/.test(z), cost: 13_900_00, min: 5, max: 8 },
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
    label: `Envío a domicilio · ${zone.name}`,
    description: "Correo Argentino / Andreani con seguimiento online",
    eta: etaLabel(zone.min, zone.max),
    cost: freeStandard ? 0 : zone.cost,
    free: freeStandard,
    badge: freeStandard ? "Envío gratis" : undefined,
  });

  const isCordobaCity = /^50[0-1]\d$/.test(zone.zip);
  if (isCordobaCity) {
    options.push({
      id: "express",
      label: "Moto express en el día",
      description: "Cadetería propia dentro de Córdoba Capital",
      eta: "Hoy mismo si comprás antes de las 16 hs",
      cost: 7_900_00,
      free: false,
      badge: "Más rápido",
    });
  } else {
    options.push({
      id: "express",
      label: "Envío express 24/48 hs",
      description: "Andreani prioritario puerta a puerta",
      eta: etaLabel(1, 2),
      cost: Math.round(zone.cost * 1.7),
      free: false,
      badge: "Más rápido",
    });
  }

  return options;
}

export function findShippingOption(zip: string, subtotal: number, id: DeliveryMethod): ShippingOption | null {
  return shippingOptions(zip, subtotal).find((option) => option.id === id) ?? null;
}
