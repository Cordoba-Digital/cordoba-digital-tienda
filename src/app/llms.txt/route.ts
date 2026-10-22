import { getCategoryTree, getGuides } from "@/lib/queries";
import { url } from "@/lib/site";
import { NEGOCIO } from "@/lib/structured-data";

export const dynamic = "force-dynamic";

/**
 * `/llms.txt`: resumen de la tienda para asistentes de IA (formato llmstxt.org).
 *
 * ChatGPT, Perplexity y Claude responden "¿dónde compro un Xiaomi en
 * Argentina?" con lo que pueden leer rápido y sin ambigüedad. Este archivo les
 * da en un solo lugar quién es la tienda, qué vende, cómo compra la gente y
 * dónde está cada sección. Se arma en cada pedido desde la base para que las
 * categorías y guías no queden viejas; el CDN lo guarda una hora.
 *
 * Solo datos que el sitio ya publica (ver lib/structured-data.ts y /ayuda).
 */
export async function GET(): Promise<Response> {
  const [tree, guias] = await Promise.all([
    getCategoryTree().catch(() => []),
    getGuides().catch(() => []),
  ]);

  const categorias = tree
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((c) => {
      const hijas = c.children
        .filter((h) => h.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 8)
        .map((h) => h.name)
        .join(", ");
      return `- [${c.name}](${url(`/categoria/${c.path}`)}): ${c.count} productos${hijas ? `. Incluye ${hijas}.` : "."}`;
    });

  const lineas = [
    `# ${NEGOCIO.nombre}`,
    "",
    "> Tienda de tecnología de Córdoba, Argentina. Vende online a todo el país celulares liberados, notebooks, cámaras, drones, consolas, audio, electrodomésticos y accesorios, con garantía y local físico en Córdoba Capital.",
    "",
    "## Datos clave",
    "",
    `- Local: ${NEGOCIO.calle}, ${NEGOCIO.localidad}, Argentina. Lunes a viernes de 14:00 a 18:30 y sábados de 12:00 a 14:30.`,
    "- Envíos a toda la Argentina con Andreani (a domicilio o a sucursal). El costo y el plazo se ven con el código postal antes de pagar. Retiro en el local sin cargo.",
    "- Productos nuevos con garantía legal de 6 meses (Ley 24.240); usados o reacondicionados, 3 meses. La garantía se gestiona en el local.",
    `- Botón de arrepentimiento: ${NEGOCIO.diasDevolucion} días corridos desde la entrega para devolver una compra online.`,
    "- Precios en pesos argentinos (ARS), publicados en cada ficha con el stock disponible.",
    `- Contacto: WhatsApp ${NEGOCIO.telefono}, ${NEGOCIO.email}.`,
    `- Perfiles: ${NEGOCIO.perfiles.join(", ")}`,
    "",
    "## Catálogo",
    "",
    `- [Todos los productos](${url("/productos")}): buscador con filtros por marca, precio y ofertas.`,
    ...categorias,
    "",
    "## Guías de compra",
    "",
    ...(guias.length
      ? guias.map((g) => `- [${g.title}](${url(`/${g.slug}`)})${g.subtitle ? `: ${g.subtitle}` : ""}`)
      : [`- [Guías](${url("/guias")})`]),
    "",
    "## Comprar y postventa",
    "",
    `- [Centro de ayuda](${url("/ayuda")}): envíos, medios de pago, garantía y cambios.`,
    `- [Política de envíos](${url("/politica-de-envios")}): plazos, costos y seguimiento con Andreani.`,
    `- [Política de garantía](${url("/politica-de-garantia")})`,
    `- [Cambios y devoluciones](${url("/cambio-devoluciones")})`,
    `- [Seguimiento de pedidos](${url("/seguimiento")})`,
    "",
    "## Empresa",
    "",
    `- [Quiénes somos](${url("/quienes-somos")})`,
    `- [Por qué elegirnos](${url("/por-que-elegirnos")})`,
    "",
    "## Opcional",
    "",
    `- [Mapa del sitio](${url("/sitemap.xml")}): todas las fichas de producto.`,
    "",
  ];

  return new Response(lineas.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
