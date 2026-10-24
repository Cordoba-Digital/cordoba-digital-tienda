/**
 * Datos de la empresa para los JSON-LD, en un solo lugar.
 *
 * Google y los buscadores de IA arman la "entidad" Córdoba Digital juntando lo
 * que dice cada página. Si la home dice una dirección, la ficha otra y el pie
 * un teléfono distinto, la entidad queda débil. Por eso todo sale de acá y cada
 * página referencia a la organización por su `@id` en vez de repetirla.
 *
 * Todo lo que figura acá está publicado en el sitio (pie, /ayuda,
 * /cambio-devoluciones). No agregar datos que no estén visibles: Google toma el
 * JSON-LD para el panel de negocio y un dato falso ahí es peor que ninguno.
 */

import { esMarcaDeRelleno } from "@/lib/brand-from-name";
import { feedCondition } from "@/lib/merchant-feed";
import { SITE_URL, url } from "@/lib/site";

export const ORG_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const STORE_ID = `${SITE_URL}/#store`;

export const NEGOCIO = {
  nombre: "Córdoba Digital",
  telefono: "+543516777774",
  email: "consultas@cordobadigital.net",
  calle: "27 de Abril 180",
  localidad: "Córdoba",
  provincia: "Córdoba",
  pais: "AR",
  /** Perfiles públicos enlazados desde el pie del sitio. */
  perfiles: ["https://instagram.com/cordobadigital.ok", "https://facebook.com/cbadigital"],
  /** Los mismos horarios que publica /ayuda ("¿Puedo retirar en el local?"). */
  horarios: [
    { dias: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], abre: "14:00", cierra: "18:30" },
    { dias: ["Saturday"], abre: "12:00", cierra: "14:30" },
  ],
  /** Botón de arrepentimiento, Art. 34 Ley 24.240 (ver /cambio-devoluciones). */
  diasDevolucion: 10,
} as const;

const direccion = {
  "@type": "PostalAddress",
  streetAddress: NEGOCIO.calle,
  addressLocality: NEGOCIO.localidad,
  addressRegion: NEGOCIO.provincia,
  addressCountry: NEGOCIO.pais,
};

/** Organización + sitio: va en el layout, una vez por página. */
export function organizationAndWebsite() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        // `OnlineStore` es una `Organization` más específica (la que usa
        // Mercado Libre): le dice a Google que la empresa vende por internet.
        "@type": "OnlineStore",
        "@id": ORG_ID,
        name: NEGOCIO.nombre,
        url: url("/"),
        logo: url("/images/logo.png"),
        email: NEGOCIO.email,
        telephone: NEGOCIO.telefono,
        address: direccion,
        sameAs: [...NEGOCIO.perfiles],
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer service",
          telephone: NEGOCIO.telefono,
          email: NEGOCIO.email,
          areaServed: "AR",
          availableLanguage: "es",
        },
      },
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        name: NEGOCIO.nombre,
        url: url("/"),
        inLanguage: "es-AR",
        publisher: { "@id": ORG_ID },
        // El buscador del catálogo: /productos?q=...
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${url("/productos")}?q={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}

/** El local físico (negocio local): solo en la home. */
export function storeJsonLd(rating?: { ratingValue: string; reviewCount: number }) {
  return {
    "@context": "https://schema.org",
    "@type": "Store",
    "@id": STORE_ID,
    name: NEGOCIO.nombre,
    url: url("/"),
    image: url("/images/logo.png"),
    logo: url("/images/logo.png"),
    telephone: NEGOCIO.telefono,
    email: NEGOCIO.email,
    priceRange: "$$",
    // Sin `postalCode` a propósito: el sitio no publica ningún código postal.
    address: direccion,
    openingHoursSpecification: NEGOCIO.horarios.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [...h.dias],
      opens: h.abre,
      closes: h.cierra,
    })),
    sameAs: [...NEGOCIO.perfiles],
    parentOrganization: { "@id": ORG_ID },
    areaServed: { "@type": "Country", name: "Argentina" },
    ...(rating
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: rating.ratingValue, reviewCount: String(rating.reviewCount) } }
      : {}),
  };
}

/** Política de devolución que Google pide en cada `Offer` de Merchant listings. */
export function returnPolicy() {
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry: NEGOCIO.pais,
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: NEGOCIO.diasDevolucion,
    returnMethod: ["https://schema.org/ReturnInStore", "https://schema.org/ReturnByMail"],
    merchantReturnLink: url("/cambio-devoluciones"),
  };
}

/**
 * `itemCondition` del `Offer`, con la misma regla que el feed de Merchant
 * Center (`feedCondition`). Antes todo lo que no era "Nuevo" salía como usado,
 * y un "Reacondicionado" quedaba usado en la ficha y reacondicionado en el feed.
 */
export function itemConditionSchema(condition: string): string {
  const valor = feedCondition(condition);
  if (valor === "new") return "https://schema.org/NewCondition";
  if (valor === "refurbished") return "https://schema.org/RefurbishedCondition";
  return "https://schema.org/UsedCondition";
}

/**
 * `brand` del `Product`, o `null` para las marcas de relleno ("General",
 * "Genérico"…): una marca falsa es peor que ninguna, y el feed ya la omite.
 */
export function brandSchema(brand: string): { "@type": "Brand"; name: string } | null {
  return esMarcaDeRelleno(brand) ? null : { "@type": "Brand", name: brand.trim() };
}

/** Miga de pan con URLs absolutas (Google ignora el `item` relativo en algunos casos). */
export function breadcrumbJsonLd(items: { name: string; path?: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      ...(item.path ? { item: url(item.path) } : {}),
    })),
  };
}

/** `JSON.stringify` seguro para meter dentro de `<script>`: escapa `</script>`. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
