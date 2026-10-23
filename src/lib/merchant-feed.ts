/**
 * Feed de productos para Google Merchant Center (RSS 2.0 con el namespace `g:`).
 *
 * Neon es la fuente de verdad: Merchant Center hace fetch recurrente contra
 * `/products.xml` y este módulo arma el XML en cada pedido (ver
 * `docs/proyecto/plan-implementacion-google-merchant-center.pdf`).
 *
 * Referencia de atributos: https://support.google.com/merchants/answer/7052112
 */

import { resolveMedia } from "@/lib/media";
import { url } from "@/lib/site";

/** Columnas mínimas de `products` que necesita el feed. */
export type FeedProduct = {
  slug: string;
  name: string;
  brand: string;
  categorySlug: string;
  shortDescription: string;
  description: string;
  descriptionHtml: string;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  images: string[];
  condition: string;
  freeShipping: boolean;
};

/** Límites de Google: título 150, descripción 5.000, hasta 10 imágenes adicionales. */
const MAX_TITLE = 150;
const MAX_DESCRIPTION = 5000;
const MAX_ADDITIONAL_IMAGES = 10;

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    // Caracteres de control que no son válidos en XML 1.0: un solo byte así
    // vuelve inválido el feed entero y Merchant Center lo rechaza completo.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|li|h[1-6]|div)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

/** Precio en el formato que exige Google: importe con dos decimales + moneda ISO. */
function feedPrice(pesos: number): string {
  // Pesos enteros, NO centavos (ver `lib/format.ts`).
  return `${pesos.toFixed(2)} ARS`;
}

/** Las fotos locales (`/images/...`) tienen que salir como URL absoluta. */
function absoluteImage(raw: string): string {
  const resolved = resolveMedia(raw);
  if (!resolved) return "";
  return resolved.startsWith("http") ? resolved : url(resolved);
}

/** Estado de la ficha (texto libre en español) a los tres valores de Google. */
function feedCondition(condition: string): "new" | "refurbished" | "used" {
  const value = condition.trim().toLowerCase();
  if (!value || value === "nuevo") return "new";
  if (value.includes("reacondicionado") || value.includes("refurb")) return "refurbished";
  return "used";
}

/** Motivo por el que un producto no entra al feed, o `null` si entra. */
export function skipReason(product: FeedProduct): string | null {
  if (!(product.price > 0)) return "sin precio";
  if (!product.images.some((img) => absoluteImage(img))) return "sin imagen";
  if (!product.name.trim()) return "sin título";
  return null;
}

function tag(name: string, value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  return `      <${name}>${escapeXml(value)}</${name}>`;
}

export function renderItem(product: FeedProduct, productType: string): string {
  const images = product.images.map(absoluteImage).filter(Boolean);
  const description =
    product.shortDescription.trim() ||
    stripHtml(product.descriptionHtml) ||
    product.description.trim() ||
    product.name;

  // Con precio tachado: `price` lleva el de lista y `sale_price` el que se cobra,
  // igual que la ficha. Sin descuento real, solo `price`.
  const onSale = product.compareAtPrice != null && product.compareAtPrice > product.price;
  const hasBrand = product.brand.trim() !== "" && product.brand !== "General";

  const lines = [
    "    <item>",
    // El slug es único y estable: si cambiara el id, Google trataría cada
    // producto como uno nuevo y perdería el historial de aprobación.
    tag("g:id", product.slug),
    tag("g:title", truncate(product.name.trim(), MAX_TITLE)),
    tag("g:description", truncate(description, MAX_DESCRIPTION)),
    tag("g:link", url(`/producto/${product.slug}`)),
    tag("g:image_link", images[0]),
    ...images.slice(1, 1 + MAX_ADDITIONAL_IMAGES).map((img) => tag("g:additional_image_link", img)),
    tag("g:availability", product.stock > 0 ? "in stock" : "out of stock"),
    tag("g:price", feedPrice(onSale ? product.compareAtPrice! : product.price)),
    onSale ? tag("g:sale_price", feedPrice(product.price)) : null,
    tag("g:condition", feedCondition(product.condition)),
    hasBrand ? tag("g:brand", product.brand.trim()) : null,
    // La base no tiene GTIN ni MPN (el campo `model` es un nombre comercial, no
    // un número de parte). Sin marca, le avisamos a Google que el producto no
    // tiene identificadores; con marca lo acepta igual, con una advertencia de
    // "identificador faltante" hasta que se carguen los GTIN.
    hasBrand ? null : tag("g:identifier_exists", "no"),
    tag("g:product_type", productType),
    product.freeShipping
      ? [
          "      <g:shipping>",
          "        <g:country>AR</g:country>",
          `        <g:price>${feedPrice(0)}</g:price>`,
          "      </g:shipping>",
        ].join("\n")
      : null,
    "    </item>",
  ];
  return lines.filter((line): line is string => line != null).join("\n");
}

export function renderFeed(items: string[], updated: Date): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Córdoba Digital</title>
    <link>${escapeXml(url("/"))}</link>
    <description>Catálogo de productos de Córdoba Digital</description>
    <lastBuildDate>${updated.toUTCString()}</lastBuildDate>
${items.join("\n")}
  </channel>
</rss>
`;
}

/**
 * Inventario local (fichas locales gratuitas y anuncios de inventario local).
 *
 * Es una fuente aparte de `/products.xml`: por cada producto dice cuánto hay en
 * el local de 27 de Abril 180. El `g:id` tiene que ser el mismo del feed
 * principal y `g:store_code` el código de tienda del Perfil de Empresa de
 * Google; si no coinciden, Merchant Center sigue marcando "Faltan datos de
 * inventario local".
 *
 * Referencia: https://support.google.com/merchants/answer/14819809
 */

/** Código de tienda del Perfil de Empresa. Se cambia con `MERCHANT_STORE_CODE`. */
export const STORE_CODE = (process.env.MERCHANT_STORE_CODE ?? "").trim() || "CBA1";

/** Columnas mínimas de `products` que necesita el inventario local. */
export type LocalInventoryProduct = Pick<FeedProduct, "slug" | "stock">;

export function renderLocalItem(product: LocalInventoryProduct, storeCode = STORE_CODE): string {
  const quantity = Math.max(0, Math.trunc(product.stock));
  return [
    "    <item>",
    tag("g:id", product.slug),
    tag("g:store_code", storeCode),
    tag("g:availability", quantity > 0 ? "in stock" : "out of stock"),
    tag("g:quantity", String(quantity)),
    // Se compra en la web y se retira en el local: el checkout lo promete
    // "listo en 2 horas hábiles", así que es retiro en el día.
    quantity > 0 ? tag("g:pickup_method", "buy") : null,
    quantity > 0 ? tag("g:pickup_sla", "same day") : null,
    "    </item>",
  ]
    .filter((line): line is string => line != null)
    .join("\n");
}

export function renderLocalFeed(items: string[], updated: Date): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Córdoba Digital · inventario del local</title>
    <link>${escapeXml(url("/"))}</link>
    <description>Stock del local de Córdoba Digital para fichas locales de Google</description>
    <lastBuildDate>${updated.toUTCString()}</lastBuildDate>
${items.join("\n")}
  </channel>
</rss>
`;
}
