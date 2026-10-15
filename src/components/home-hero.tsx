import { HeroCarousel, type HeroSlide } from "@/components/hero-carousel";
import type { ProductView } from "@/lib/product-view";

const fmt = new Intl.NumberFormat("es-AR");

// La tarjeta del hero muestra marca, precio tachado y un botón "Agregar" que
// suma al carrito de verdad, así que el producto entra completo: los campos
// vienen todos de `ProductView` y no hay que inventar nada.
function pick(p: ProductView | null): HeroSlide["product"] {
  if (!p?.image) return null;
  return {
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    image: p.image,
    srcSet: p.imageSrcSets[0],
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    stock: p.stock,
    freeShipping: p.freeShipping,
  };
}

export function HomeHero({
  productCount,
  ratingValue,
  reviewCount,
  main,
  deal,
  best,
  shipping,
  payment,
  maxOff,
}: {
  productCount: number;
  ratingValue: string | null;
  reviewCount: number | null;
  main: ProductView | null;
  deal: ProductView | null;
  best: ProductView | null;
  shipping: ProductView | null;
  payment: ProductView | null;
  /** Mayor descuento real entre las ofertas vigentes (0 si no hay). */
  maxOff: number;
}) {
  // Todo el texto sale de datos que el sitio ya publica (envíos, medios de
  // pago, garantía) o de la base: nada de promos ni cuotas inventadas.
  const slides: HeroSlide[] = [
    {
      id: "inicio",
      pill: "Local en 27 de Abril 180 · Envíos a todo el país",
      titleLead: "Tecnología que llega",
      titleAccent: "rápido, segura y con garantía",
      text: "Celulares, notebooks, cámaras, drones y gaming con stock real. Comprá online en 2 minutos, pagá como quieras y seguí tu pedido paso a paso.",
      cta: { href: "/productos", label: "Ver catálogo completo" },
      cta2: { href: "/productos?ofertas=1", label: "Ofertas de la semana" },
      stats: [
        { k: fmt.format(productCount), v: "productos" },
        { k: "6 meses", v: "de garantía legal" },
        { k: "Todo el país", v: "de envíos" },
        ...(ratingValue && reviewCount ? [{ k: `${ratingValue}★`, v: "en Google" }] : []),
      ],
      product: pick(main),
    },
    {
      id: "ofertas",
      pill: "Ofertas de la semana",
      titleLead: maxOff > 0 ? `Hasta ${maxOff}% OFF en` : "Las mejores ofertas en",
      titleAccent: "tecnología seleccionada",
      text: "Precios que bajan, productos nuevos y 6 meses de garantía legal en cada compra.",
      cta: { href: "/productos?ofertas=1", label: "Ver ofertas" },
      stats: [
        ...(maxOff > 0 ? [{ k: `${maxOff}% OFF`, v: "descuento máximo" }] : []),
        { k: "6 meses", v: "de garantía legal" },
        { k: "Todo el país", v: "de envíos" },
      ],
      product: pick(deal),
    },
    {
      id: "vendidos",
      pill: "Los más vendidos",
      titleLead: "Lo que más eligen",
      titleAccent: "nuestros clientes",
      text: "Los productos con más pedidos de la tienda, listos para despachar.",
      cta: { href: "/productos", label: "Ver el catálogo" },
      stats: [
        { k: "Top 10", v: "más vendidos" },
        { k: "6 meses", v: "de garantía legal" },
        { k: "Todo el país", v: "de envíos" },
      ],
      product: pick(best),
    },
    {
      id: "envios",
      pill: "Envíos a todo el país",
      titleLead: "Te lo llevamos",
      titleAccent: "por Andreani o lo retirás",
      text: "Elegí domicilio o sucursal y ves el costo en el checkout con tu código postal, o pasá por 27 de Abril 180, Córdoba Capital.",
      cta: { href: "/productos", label: "Elegir mi producto" },
      stats: [
        { k: "Andreani", v: "domicilio o sucursal" },
        { k: "En el local", v: "27 de Abril 180" },
        { k: "6 meses", v: "de garantía legal" },
      ],
      product: pick(shipping),
    },
    {
      id: "pagos",
      pill: "Pagá como quieras",
      titleLead: "Transferencia",
      titleAccent: "o efectivo en el local",
      text: "En el local también podés pagar en efectivo o con seña. Comprás seguro, con garantía y soporte post-venta propio.",
      cta: { href: "/productos", label: "Ver el catálogo" },
      stats: [
        { k: "Efectivo", v: "y seña en el local" },
        { k: "Transferencia", v: "bancaria" },
        { k: "6 meses", v: "de garantía legal" },
      ],
      product: pick(payment),
    },
  ];

  return <HeroCarousel slides={slides} />;
}
