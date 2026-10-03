import type { DeliveryMethod, ShippingOption } from "@/lib/shipping";
import { normalizeZip } from "@/lib/shipping";

/**
 * Validadores compartidos del checkout. Tanto la UI como la API llaman
 * aquí para que las reglas no vivan duplicadas en dos módulos.
 */

export type PersonalDataInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  docId: string;
};

export function validatePersonalData(input: PersonalDataInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input.firstName.trim().length < 2) errors.firstName = "Ingresá tu nombre.";
  if (input.lastName.trim().length < 2) errors.lastName = "Ingresá tu apellido.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email.trim())) errors.email = "Ingresá un email válido.";
  if (input.phone.replace(/\D/g, "").length < 8) errors.phone = "Ingresá un teléfono de contacto.";
  if (input.docId.replace(/\D/g, "").length < 7) errors.docId = "Ingresá tu DNI o CUIT para la factura.";
  return errors;
}

export type DeliveryDataInput = {
  method: DeliveryMethod;
  zip: string;
  street?: string;
  number?: string;
  city?: string;
  province?: string;
  selectedOption?: ShippingOption | null;
  requireShippingOption?: boolean;
};

export function validateDelivery(input: DeliveryDataInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input.method === "pickup") return errors;

  const zip = normalizeZip(input.zip);
  if (zip.length !== 4) errors.zip = "Ingresá un código postal válido.";
  if ((input.street ?? "").trim().length < 3) errors.street = "Ingresá la calle.";
  if ((input.number ?? "").trim().length < 1) errors.number = "Ingresá la altura.";
  if ((input.city ?? "").trim().length < 2) errors.city = "Ingresá la localidad.";
  if ((input.province ?? "").trim().length < 2) errors.province = "Elegí la provincia.";
  if (input.requireShippingOption && !input.selectedOption) errors.delivery = "Elegí una forma de envío.";
  return errors;
}
