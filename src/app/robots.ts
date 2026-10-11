import type { MetadataRoute } from "next";

import { url } from "@/lib/site";

/** Lo que no tiene sentido rastrear: compra, cuenta, admin y la API. */
const PRIVADO = ["/checkout", "/pedido/", "/api/", "/admin", "/carrito", "/favoritos", "/mi-cuenta", "/ingresar"];

/**
 * Buscadores y asistentes de IA, nombrados uno por uno a propósito.
 *
 * Con `*` ya entraban, pero varios WAF y CDN bloquean por defecto a los bots
 * de IA que no aparecen explícitos, y algunos de estos bots (OAI-SearchBot,
 * PerplexityBot, Claude-SearchBot) son los que deciden si la tienda aparece
 * como fuente en ChatGPT, Perplexity o Claude cuando alguien pregunta dónde
 * comprar. Ojo: un bot con grupo propio ignora el de `*`, por eso cada grupo
 * repite la lista de rutas privadas.
 */
const BOTS_IA = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "GPTBot",
  "PerplexityBot",
  "Perplexity-User",
  "Claude-SearchBot",
  "Claude-User",
  "ClaudeBot",
  "Google-Extended",
  "Applebot-Extended",
  "Bingbot",
];

/**
 * `/api/` está cerrado, salvo las fotos de las primeras subidas del admin, que
 * se sirven desde `/api/imagenes/` (ver lib/product-images.ts): sin esta
 * excepción Google no puede leer la imagen del producto ni para Imágenes ni
 * para Merchant. Gana la regla más larga, así que esta pisa a `/api/`.
 */
const PERMITIDO = ["/", "/api/imagenes/"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: PERMITIDO, disallow: PRIVADO },
      { userAgent: BOTS_IA, allow: PERMITIDO, disallow: PRIVADO },
    ],
    sitemap: url("/sitemap.xml"),
  };
}
