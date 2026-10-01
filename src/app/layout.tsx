import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";

import { CartDrawer, Toaster } from "@/components/cart-drawer";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { StoreProvider } from "@/components/store-provider";
import { WhatsAppFab } from "@/components/whatsapp-fab";
import { getCategoryTree, getGuides, type CategoryTreeNode, type GuideTeaser } from "@/lib/queries";
import "./globals.css";

import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  // Apuntaba al dominio viejo. Todos los canonicals son relativos y se
  // resuelven contra este valor, así que cambiar el dominio es una sola línea.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Córdoba Digital · Tecnología con garantía y envíos a todo el país",
    template: "%s · Córdoba Digital",
  },
  description:
    "Celulares liberados, notebooks, cámaras, drones, consolas y más. Envíos a todo el país por Andreani y retiro en Córdoba Capital.",
  keywords: [
    "comprar celulares Córdoba",
    "notebooks Córdoba",
    "tecnología Argentina",
    "ecommerce tecnología",
    "Córdoba Digital",
  ],
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: "Córdoba Digital",
    title: "Córdoba Digital · Tecnología con garantía oficial",
    description:
      "La tienda de tecnología de Córdoba: envíos a todo el país y soporte post-venta real.",
    images: [{ url: "/images/logo.png", alt: "Córdoba Digital" }],
  },
  icons: {
    icon: "/images/logo.png",
    apple: "/images/logo.png",
  },
};

/* Plus Jakarta Sans servida desde `public/fonts`: sin dependencia de Google
   Fonts en build ni en runtime. */
const jakarta = localFont({
  src: [
    { path: "../../public/fonts/plus-jakarta-sans-400-latin.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/plus-jakarta-sans-500-latin.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/plus-jakarta-sans-600-latin.woff2", weight: "600", style: "normal" },
    { path: "../../public/fonts/plus-jakarta-sans-700-latin.woff2", weight: "700", style: "normal" },
    { path: "../../public/fonts/plus-jakarta-sans-800-latin.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-jakarta",
  display: "swap",
});

export default async function RootLayout({ children }: { children: ReactNode }) {
  type NavNode = {
    slug: string;
    name: string;
    icon: string;
    path: string;
    count: number;
    children?: NavNode[];
  };
  // Árbol y guías en paralelo: son independientes y este layout corre en
  // TODAS las páginas. Cada uno conserva su fallback por separado con
  // `allSettled`: si la base no responde, la página igual se dibuja.
  const [treeRes, guideRes] = await Promise.allSettled([getCategoryTree(), getGuides()]);
  let categories: (NavNode & { tagline: string })[] = [];
  try {
    if (treeRes.status !== "fulfilled") throw new Error("sin árbol");
    // El mapeo baja los tres niveles del árbol, no uno: el header muestra los
    // nietos indentados dentro del panel de cada raíz. Antes los recortaba acá
    // y la información no llegaba al componente.
    const toNavNode = (node: CategoryTreeNode): NavNode => ({
      slug: node.slug,
      name: node.name,
      icon: node.icon,
      path: node.path,
      count: node.count,
      children: node.children.length ? node.children.map(toNavNode) : undefined,
    });
    categories = treeRes.value.map((c) => ({ ...toNavNode(c), tagline: c.tagline }));
  } catch {
    categories = [];
  }

  // Guías de compra para la columna del pie. Si la base no responde, el pie se
  // dibuja sin esa columna: no vale la pena romper todas las páginas por un
  // bloque que es solo un listado de enlaces.
  let guides: GuideTeaser[] = guideRes.status === "fulfilled" ? guideRes.value : [];

  return (
    <html lang="es-AR" className={jakarta.variable}>
      <head>
        {/* Las fotos del catálogo viven en el WordPress original: el
            preconnect ahorra el handshake en la primera imagen (LCP). */}
        <link rel="preconnect" href="https://www.cordobadigital.net" />
        <link rel="dns-prefetch" href="https://www.cordobadigital.net" />
      </head>
      <body className="min-h-screen bg-ink-50 text-ink-900 antialiased">
        <StoreProvider>
          <SiteHeader categories={categories} />
          <main className="min-h-[60vh]">{children}</main>
          <SiteFooter
            categories={categories.map((c) => ({ name: c.name, path: c.path, count: c.count }))}
            cuit={process.env.STORE_CUIT?.trim() ?? ""}
            guides={guides}
          />
          <CartDrawer />
          <Toaster />
          <WhatsAppFab />
        </StoreProvider>
      </body>
    </html>
  );
}
