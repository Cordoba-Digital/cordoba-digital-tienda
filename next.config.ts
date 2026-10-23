import type { NextConfig } from "next";

import { CATEGORY_MERGES, mergedCategoryRedirect } from "./src/lib/category-merges";

/** Store de Vercel Blob donde están las fotos de producto (ver docs/IMAGENES.md). */
const BLOB_HOST = "6weoa5xmoylnh9pt.public.blob.vercel-storage.com";

/** Dominio público de las fotos en Cloudflare R2 (ver src/lib/r2.ts). */
const r2Host = (() => {
  try {
    return process.env.R2_PUBLIC_URL ? new URL(process.env.R2_PUBLIC_URL).hostname : null;
  } catch {
    return null;
  }
})();

/** Para todo el sitio, panel incluido. */
const SECURITY_HEADERS = [
  // Solo HTTPS por dos años. Sin includeSubDomains: puede haber subdominios
  // del hosting viejo sin certificado.
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
  // La tienda no usa cámara, micrófono ni ubicación; ningún script de terceros puede pedirlos.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/**
 * Para la tienda. El CSP no limita scripts (Next, GA, WhatsApp y el JSON-LD
 * van inline): cierra iframes ajenos, `<base>` y plugins, que es lo que se
 * puede sin romper nada.
 */
const STORE_HEADERS = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

/**
 * Páginas del WordPress sin una igual en la tienda nueva, sacadas del
 * `page-sitemap.xml` del sitio viejo. Las que existen con la misma dirección
 * (quienes-somos, politica-de-garantia, carrito, checkout, etc.) no necesitan
 * nada. Sin esto, desde el cambio de dominio darían 404 y Google las sacaría
 * del índice en vez de pasarle su posición a la página nueva.
 */
export const PAGINAS_WP: [string, string][] = [
  ["/contacto", "/ayuda"],
  ["/terminos-condiciones", "/terminos-y-condiciones"],
  ["/formulario-de-sugerencias-y-reclamos", "/ayuda"],
  ["/formas-de-pago-mercadopago-todopago-tarjetas-de-credito", "/ayuda#pagos"],
  ["/condiciones-de-garantia", "/politica-de-garantia"],
  ["/blog", "/guias"],
  // Portada del blog: sale en el post-sitemap pero no es una nota.
  ["/actualidad-digital", "/guias"],
  ["/finalizar-compra", "/checkout"],
  ["/cart", "/carrito"],
  ["/my-account", "/mi-cuenta"],
  ["/compare", "/productos"],
  // Borradores de Elementor que quedaron publicados.
  ["/home-v3-full-color-background", "/"],
  ["/elementor-172394", "/"],
];

const nextConfig: NextConfig = {
  // Las URLs del catálogo migrado desde WooCommerce. Son 301 porque el
  // contenido ya no existe en las rutas viejas: la equivalencia es 1:1
  // (mismos slugs), salvo marca/etiqueta que ahora son filtros de /productos.
  async redirects() {
    // Categorías fusionadas (ver src/lib/category-merges.ts): 308 real desde la
    // URL nueva y desde la de WordPress, sin pasar por dos saltos. La página
    // también redirige, pero ahí la respuesta ya salió con 200 y queda como
    // meta refresh, que Google no trata igual que un redirect.
    const fusionadas = CATEGORY_MERGES.flatMap(({ from }) => {
      const destination = mergedCategoryRedirect(from)!;
      return [
        { source: `/categoria/${from}`, destination, permanent: true },
        { source: `/categoria-producto/${from}`, destination, permanent: true },
      ];
    });
    return [
      ...fusionadas,
      ...PAGINAS_WP.map(([source, destination]) => ({ source, destination, permanent: true })),
      // Las páginas 2, 3… de los listados de WooCommerce. Van antes que la
      // regla general de categorías, que las mandaría a una subcategoría "page".
      {
        source: "/categoria-producto/:ruta*/page/:n(\\d+)",
        destination: "/categoria/:ruta*?pagina=:n",
        permanent: true,
      },
      { source: "/marca/:marca/page/:n(\\d+)", destination: "/productos?marca=:marca&pagina=:n", permanent: true },
      { source: "/tienda/page/:n(\\d+)", destination: "/productos?pagina=:n", permanent: true },
      {
        // /categoria-producto/computacion/notebooks-cordoba/asus
        // -> /categoria/computacion/notebooks-cordoba/asus
        source: "/categoria-producto/:ruta*",
        destination: "/categoria/:ruta*",
        permanent: true,
      },
      { source: "/marca/:marca", destination: "/productos?marca=:marca", permanent: true },
      { source: "/etiqueta-producto/:tag", destination: "/productos?q=:tag", permanent: true },
      { source: "/tienda", destination: "/productos", permanent: true },
    ];
  },
  /**
   * Los submaps del indice de sitemaps. Next 16 no registra una carpeta cuyo
   * nombre mezcla texto estatico con un segmento dinamico (`sitemap-[id].xml`
   * da 404 y ni aparece en el manifest de rutas), asi que el handler vive en
   * `/sitemap/[id]` y la URL publica `/sitemap-:id.xml` se reescribe aca.
   */
  /**
   * `*.vercel.app` no se indexa nunca. Hoy la tienda nueva vive solo ahí
   * mientras www.cordobadigital.net sigue sirviendo el WordPress, que es el que
   * Google tiene indexado: con las dos versiones indexables, Google ve el mismo
   * catálogo en dos dominios y reparte (o pierde) el posicionamiento. Cuando el
   * dominio real apunte a este proyecto, esto también evita que la URL técnica
   * de Vercel compita con él. Se manda como header y no en robots.txt para que
   * Google pueda rastrear la página, leer el noindex y sacarla del índice.
   */
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      // El panel manda los suyos desde el middleware, más estrictos (DENY,
      // same-origin). Con `next start` el middleware pisa estos, pero no
      // dependemos del orden en que Vercel los aplica: a /admin y /api/admin
      // no se les mandan.
      { source: "/((?!admin|api/admin).*)", headers: STORE_HEADERS },
      {
        source: "/:path*",
        has: [{ type: "host", value: "(?<sub>.*)\\.vercel\\.app" }],
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
  async rewrites() {
    return [{ source: "/sitemap-:id.xml", destination: "/sitemap/:id" }];
  },
  images: {
    // Con el plan Pro el optimizador de Vercel funciona: las fotos se sirven
    // achicadas al tamaño de cada lugar (ver ProductImg). En Hobby respondía
    // `OPTIMIZED_EXTERNAL_IMAGE_REQUEST_UNAUTHORIZED` y estaba apagado.
    formats: ["image/avif", "image/webp"],
    // Pocos anchos: alcanzan para miniaturas, cards y la foto grande, y cada
    // ancho de menos es una variante menos por foto (y un srcset más corto).
    // Nada pasa de 1600 px porque las fotos se guardan con ese máximo.
    imageSizes: [96, 256, 384],
    deviceSizes: [640, 828, 1080, 1600],
    // Las fotos guardadas no cambian (cada subida tiene su URL): un mes en caché.
    minimumCacheTTL: 2_678_400,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
      {
        protocol: "https",
        hostname: "www.cordobadigital.net",
      },
      {
        protocol: "https",
        hostname: "cordobadigital.net",
      },
      // Solo nuestras fotos: con un comodín (`*.public.blob.vercel-storage.com`,
      // `*.r2.dev`) cualquiera podía pasar imágenes de su propio bucket por el
      // optimizador y gastar la cuota del plan. Si se cambia de store de Blob,
      // hay que actualizar este host (es el de las URLs de las fotos).
      { protocol: "https", hostname: BLOB_HOST },
      ...(r2Host ? [{ protocol: "https" as const, hostname: r2Host }] : []),
    ],
  },
};

export default nextConfig;
