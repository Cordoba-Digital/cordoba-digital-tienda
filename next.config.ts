import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Las URLs del catálogo migrado desde WooCommerce. Son 301 porque el
  // contenido ya no existe en las rutas viejas: la equivalencia es 1:1
  // (mismos slugs), salvo marca/etiqueta que ahora son filtros de /productos.
  async redirects() {
    return [
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
  async rewrites() {
    return [{ source: "/sitemap-:id.xml", destination: "/sitemap/:id" }];
  },
  images: {
    // El optimizador de imágenes de Vercel responde
    // `OPTIMIZED_EXTERNAL_IMAGE_REQUEST_UNAUTHORIZED` en este proyecto
    // (equipo JAC, plan Hobby) y las fotos no cargan en el deploy. Con
    // `unoptimized` los <Image> conservan lazy-loading y el layout, pero
    // sirven el archivo original del servidor viejo.
    //
    // Para reactivarlo: borrar esta línea (wp-content ya está permitido abajo)
    // y comprobar que /_next/image devuelva 200 con content-type de imagen.
    unoptimized: true,
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
    ],
  },
};

export default nextConfig;
