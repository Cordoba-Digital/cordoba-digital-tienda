/**
 * Links de WhatsApp de la tienda y el mensaje del botón flotante.
 *
 * El botón flotante vive en el layout y no sabe en qué página está. En una
 * ficha, la caja de compra anota el producto acá y el botón arma el mismo
 * mensaje que "Consultar"; al salir de la ficha lo borra y vuelve el genérico.
 */
export const WHATSAPP_NUMBER = "5493516777774";

export const GENERIC_WHATSAPP_MESSAGE = "Hola Córdoba Digital! Tengo una consulta";

export function productWhatsAppMessage(productName: string): string {
  return `Hola! Quiero consultar por ${productName}`;
}

export function whatsappLink(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

let currentProduct: string | null = null;
const listeners = new Set<() => void>();

export function setWhatsAppProduct(productName: string | null): void {
  if (currentProduct === productName) return;
  currentProduct = productName;
  for (const listener of listeners) listener();
}

export function getWhatsAppProduct(): string | null {
  return currentProduct;
}

export function subscribeWhatsAppProduct(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Mensaje del botón flotante según el producto que se está viendo (o ninguno). */
export function fabWhatsAppMessage(productName: string | null): string {
  return productName ? productWhatsAppMessage(productName) : GENERIC_WHATSAPP_MESSAGE;
}
