/**
 * SEO y GEO de las páginas de categoría.
 *
 * Sale de comparar con Mercado Libre y Frávega (octubre 2026, ver
 * docs/SEO-GEO-COMPETENCIA.md):
 *
 * - Mercado Libre mete en el listado un `Product` completo por resultado
 *   (precio, stock, marca, imagen). Con eso un buscador compara precios desde
 *   la categoría sin abrir cada ficha. Nuestro `ItemList` solo tenía nombre y URL.
 * - Frávega agrega un `FAQPage` por categoría, pero con respuestas genéricas
 *   escritas a mano. Las nuestras salen del catálogo (rango de precios, marcas,
 *   stock), que es el tipo de dato concreto que un asistente de IA cita.
 *
 * Las preguntas se muestran en la página además de ir en el JSON-LD: Google
 * pide que el FAQ estructurado coincida con lo visible.
 */

import { money } from "@/lib/format";
import { url } from "@/lib/site";
import { NEGOCIO } from "@/lib/structured-data";

/** Lo mínimo de cada tarjeta que hace falta para el `Product` del listado. */
export type ItemListProduct = {
  slug: string;
  name: string;
  brand: string;
  price: number;
  stock: number;
  images: string[];
};

/** Precios y stock de toda la categoría (subcategorías incluidas). */
export type CategoryStats = {
  total: number;
  inStock: number;
  /** Precio más bajo y más alto de los productos con precio cargado. Pesos enteros. */
  minPrice: number | null;
  maxPrice: number | null;
  /** Marcas con su cantidad de productos, en cualquier orden. */
  brands: { brand: string; count: number }[];
};

export type CategoryFaqItem = { pregunta: string; respuesta: string };

/** Las fotos subidas desde el admin se guardan con ruta relativa. */
function absoluta(img: string): string {
  return img.startsWith("/") ? url(img) : img;
}

/**
 * `ItemList` de la página actual con un `Product` por posición, al estilo de
 * Mercado Libre. El `@id` es el mismo de la ficha (`/producto/x#product`), así
 * los buscadores unen el listado con la ficha como una sola entidad.
 */
export function categoryItemListJsonLd(input: {
  name: string;
  total: number;
  /** Cuántos productos hay antes de esta página (página 3 de 24 → 48). */
  offset: number;
  items: ItemListProduct[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: input.name,
    numberOfItems: input.total,
    itemListElement: input.items.map((p, i) => {
      const ficha = url(`/producto/${p.slug}`);
      return {
        "@type": "ListItem",
        position: input.offset + i + 1,
        url: ficha,
        item: {
          "@type": "Product",
          "@id": `${ficha}#product`,
          name: p.name,
          url: ficha,
          ...(p.images[0] ? { image: absoluta(p.images[0]) } : {}),
          ...(p.brand && p.brand !== "General" ? { brand: { "@type": "Brand", name: p.brand } } : {}),
          // Sin precio cargado no hay oferta: un `price: 0` se lee como "gratis".
          ...(p.price > 0
            ? {
                offers: {
                  "@type": "Offer",
                  priceCurrency: "ARS",
                  price: p.price,
                  availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                  url: ficha,
                },
              }
            : {}),
        },
      };
    }),
  };
}

/** "Samsung, Motorola y Xiaomi". */
function enumerar(nombres: string[]): string {
  if (nombres.length <= 1) return nombres.join("");
  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}

/**
 * Preguntas frecuentes de una categoría, armadas con datos reales del catálogo.
 *
 * Solo entran las preguntas que se pueden contestar con datos: sin productos
 * no hay pregunta de precios, sin marcas reconocibles no hay pregunta de
 * marcas. Envío, garantía y local repiten lo que publican /ayuda y llms.txt.
 */
export function categoryFaq(nombre: string, stats: CategoryStats): CategoryFaqItem[] {
  const faq: CategoryFaqItem[] = [];

  if (stats.total > 0 && stats.minPrice != null && stats.maxPrice != null) {
    const rango =
      stats.minPrice === stats.maxPrice
        ? `con un precio de ${money(stats.minPrice)}`
        : `con precios desde ${money(stats.minPrice)} hasta ${money(stats.maxPrice)}`;
    const disponibles =
      stats.inStock === stats.total
        ? "Todos tienen stock disponible."
        : `${stats.inStock.toLocaleString("es-AR")} tienen stock disponible para comprar ya.`;
    faq.push({
      pregunta: `¿Cuánto salen los productos de ${nombre} en ${NEGOCIO.nombre}?`,
      respuesta: `Hoy hay ${stats.total.toLocaleString("es-AR")} producto${stats.total === 1 ? "" : "s"} en ${nombre}, ${rango} en pesos argentinos. ${disponibles} El precio final y las cuotas se ven en cada ficha.`,
    });
  }

  const marcas = stats.brands
    .filter((b) => b.brand && b.brand !== "General" && b.count > 0)
    .sort((a, b) => b.count - a.count || a.brand.localeCompare(b.brand, "es"))
    .slice(0, 6)
    .map((b) => b.brand);
  if (marcas.length) {
    faq.push({
      pregunta: `¿Qué marcas de ${nombre} venden?`,
      respuesta: `En ${nombre} las marcas con más productos son ${enumerar(marcas)}. Se puede filtrar por marca y por precio desde esta misma página.`,
    });
  }

  faq.push(
    {
      pregunta: `¿Hacen envíos de ${nombre} a todo el país?`,
      respuesta:
        "Sí. Enviamos a toda la Argentina con Andreani, a domicilio o a sucursal. El costo y el plazo se ven con el código postal antes de pagar. También podés retirar sin cargo en el local.",
    },
    {
      pregunta: `¿Qué garantía tienen los productos de ${nombre}?`,
      respuesta: `Los productos nuevos tienen garantía legal de 6 meses (Ley 24.240) y los usados o reacondicionados, 3 meses. Además tenés ${NEGOCIO.diasDevolucion} días corridos desde la entrega para arrepentirte de una compra online.`,
    },
    {
      pregunta: `¿Puedo ver ${nombre} en un local físico?`,
      respuesta: `Sí. El local está en ${NEGOCIO.calle}, ${NEGOCIO.localidad}. Atendemos de lunes a viernes de 14:00 a 18:30 y los sábados de 12:00 a 14:30.`,
    },
  );

  return faq;
}

/** `FAQPage` con las mismas preguntas que se muestran en la página. */
export function faqPageJsonLd(faq: CategoryFaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.pregunta,
      acceptedAnswer: { "@type": "Answer", text: item.respuesta },
    })),
  };
}
