import type { PaymentMethodId } from "@/lib/pricing";
import type { DeliveryMethod } from "@/lib/shipping";

/**
 * Medios de pago que el checkout acepta hoy. La UI y la API leen esta lista,
 * así que un medio oculto en pantalla tampoco se puede pedir llamando a la API
 * a mano. USDT no está en la lista: aparece solo cuando hay una wallet
 * cargada en Admin → Medios de pago.
 */
export const CHECKOUT_PAYMENT_METHODS: readonly PaymentMethodId[] = ["transferencia", "sena"];

/**
 * Mercado Pago se suma solo cuando el servidor tiene sus credenciales
 * (`mercadoPagoReady()` en `lib/mercadopago`) y USDT solo con una wallet
 * cargada (`getUsdtWallet()`). Este archivo lo usa también el navegador, así
 * que el dato llega como opción y no leyendo la base ni variables de entorno.
 */
export type PaymentOptions = {
  mercadoPago?: boolean;
  usdt?: boolean;
  /**
   * Pedido cargado por el local desde el panel: ahí sigue existiendo el
   * efectivo en el mostrador. En la tienda online, retirar es con seña.
   */
  manual?: boolean;
};

export function isPaymentMethodOffered(
  method: PaymentMethodId,
  delivery: DeliveryMethod,
  options: PaymentOptions = {},
): boolean {
  if (method === "mercadopago") return !!options.mercadoPago;
  if (method === "usdt") return !!options.usdt;
  // El efectivo y la seña se completan en el mostrador: solo existen retirando.
  if (method === "efectivo") return !!options.manual && delivery === "pickup";
  if (!CHECKOUT_PAYMENT_METHODS.includes(method)) return false;
  return method !== "sena" || delivery === "pickup";
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
  if ((raw === "sena" || (raw === "efectivo" && options.manual)) && delivery !== "pickup") {
    return { ok: false, error: "La seña y el pago en el local solo están disponibles retirando en el local." };
  }
  return { ok: false, error: "Ese medio de pago no está disponible." };
}

