import type { PaymentMethodId } from "@/lib/pricing";
import type { DeliveryMethod } from "@/lib/shipping";

/**
 * Medios de pago que el checkout acepta hoy. La UI y la API leen esta lista,
 * así que un medio oculto en pantalla tampoco se puede pedir llamando a la API
 * a mano. USDT se suma acá cuando el negocio lo active.
 */
export const CHECKOUT_PAYMENT_METHODS: readonly PaymentMethodId[] = ["transferencia", "efectivo"];

/**
 * Mercado Pago se suma solo cuando el servidor tiene sus credenciales
 * (`mercadoPagoReady()` en `lib/mercadopago`). Este archivo lo usa también el
 * navegador, así que el dato llega como opción y no leyendo variables de entorno.
 */
export type PaymentOptions = { mercadoPago?: boolean };

export function isPaymentMethodOffered(
  method: PaymentMethodId,
  delivery: DeliveryMethod,
  options: PaymentOptions = {},
): boolean {
  if (method === "mercadopago") return !!options.mercadoPago;
  if (!CHECKOUT_PAYMENT_METHODS.includes(method)) return false;
  // El efectivo se paga en el mostrador, así que solo existe retirando.
  return method !== "efectivo" || delivery === "pickup";
}

export type PaymentResolution = { ok: true; method: PaymentMethodId } | { ok: false; error: string };

/**
 * Valida el medio de pago que manda el cliente. Sin medio, transferencia; un
 * medio desconocido u oculto se rechaza en vez de cambiarse en silencio.
 */
export function resolvePaymentMethod(
  raw: unknown,
  delivery: DeliveryMethod,
  options: PaymentOptions = {},
): PaymentResolution {
  if (raw === undefined || raw === null || raw === "") return { ok: true, method: "transferencia" };
  const method = raw as PaymentMethodId;
  if (typeof raw === "string" && isPaymentMethodOffered(method, delivery, options)) return { ok: true, method };
  if (raw === "efectivo" && CHECKOUT_PAYMENT_METHODS.includes("efectivo")) {
    return { ok: false, error: "El pago en efectivo solo está disponible retirando en el local." };
  }
  return { ok: false, error: "Ese medio de pago no está disponible." };
}

