/**
 * Eventos de comercio electrónico para Google Analytics 4.
 *
 * El script de gtag solo se carga si está definida `GA_MEASUREMENT_ID` (ver
 * `components/google-analytics.tsx`). Sin esa variable `window.gtag` no existe
 * y estas funciones no hacen nada, así que se pueden llamar siempre.
 *
 * Nombres y parámetros según
 * https://developers.google.com/analytics/devguides/collection/ga4/ecommerce
 */

type GtagItem = {
  item_id: string;
  item_name: string;
  item_brand?: string;
  price: number;
  quantity: number;
};

type Gtag = (command: "event", name: string, params: Record<string, unknown>) => void;

declare global {
  interface Window {
    gtag?: Gtag;
  }
}

function send(name: string, params: Record<string, unknown>): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  // Precios en pesos enteros (ver `lib/format.ts`): GA4 los toma tal cual.
  window.gtag("event", name, { currency: "ARS", ...params });
}

function value(items: GtagItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function trackViewItem(item: GtagItem): void {
  send("view_item", { value: item.price * item.quantity, items: [item] });
}

export function trackAddToCart(item: GtagItem): void {
  send("add_to_cart", { value: item.price * item.quantity, items: [item] });
}

export function trackBeginCheckout(items: GtagItem[]): void {
  send("begin_checkout", { value: value(items), items });
}

export function trackPurchase(order: {
  transactionId: string;
  value: number;
  shipping: number;
  coupon?: string | null;
  items: GtagItem[];
}): void {
  send("purchase", {
    transaction_id: order.transactionId,
    value: order.value,
    shipping: order.shipping,
    ...(order.coupon ? { coupon: order.coupon } : {}),
    items: order.items,
  });
}
