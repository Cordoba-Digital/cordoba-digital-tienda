import { MercadoPagoConfig } from "mercadopago";

export const MP_CURRENCY = "ARS";

export function mpClient() {
  const token = process.env.MP_ACCESS_TOKEN?.trim();
  if (!token) return null;
  return new MercadoPagoConfig({ accessToken: token });
}

/**
 * Mercado Pago se ofrece en el checkout solo con las dos credenciales cargadas:
 * el Access Token para crear el cobro y la clave secreta del webhook para
 * confirmarlo. Con una sola, el cliente pagaría y el pedido nunca se acreditaría.
 */
export function mercadoPagoReady(): boolean {
  return !!process.env.MP_ACCESS_TOKEN?.trim() && !!process.env.MP_WEBHOOK_SECRET?.trim();
}

export function appBaseUrl(request?: Request): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (request) {
    try {
      const url = new URL(request.url);
      return `${url.protocol}//${url.host}`;
    } catch {
      // fall through
    }
  }
  return "http://localhost:3000";
}

/** auto_return=approved solo con URL pública HTTPS (MP rechaza localhost). */
export function isPublicAppUrl(url: string): boolean {
  return (
    /^https:\/\//i.test(url) &&
    !/^https:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::|\/|$)/i.test(url)
  );
}

/**
 * ARS pesos -> número para la preferencia de Mercado Pago.
 *
 * OJO: los precios se guardan en **pesos enteros**, no en centavos (ver
 * `lib/format.ts`). Esta función antes se llamaba `centsToUnits` y dividía
 * entre 100, lo que hacía que Checkout Pro cobrara la centésima parte:
 * $33.000 por un celular de $3.299.999. No escala nada: solo redondea.
 */
export function pesosToUnits(price: number): number {
  return Math.round(price);
}
