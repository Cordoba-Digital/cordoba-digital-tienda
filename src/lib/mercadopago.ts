import { MercadoPagoConfig } from "mercadopago";

export const MP_CURRENCY = "ARS";

export function mpClient() {
  const token = process.env.MP_ACCESS_TOKEN?.trim();
  if (!token) return null;
  return new MercadoPagoConfig({ accessToken: token });
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

/** ARS pesos -> número con 2 decimales para la preferencia. Precios guardados en centavos. */
export function centsToUnits(cents: number): number {
  return Math.round(cents) / 100;
}
