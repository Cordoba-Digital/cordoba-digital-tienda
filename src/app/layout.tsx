import type { Metadata } from "next";
import type { ReactNode } from "react";

import { CartDrawer, Toaster } from "@/components/cart-drawer";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { StoreProvider } from "@/components/store-provider";
import { WhatsAppFab } from "@/components/whatsapp-fab";
import { getCategoryTree, getGuides, type CategoryTreeNode, type GuideTeaser } from "@/lib/queries";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.cordobadigital.net"),
  title: {
    default: "Córdoba Digital · Tecnología con garantía y envíos a todo el país",
    template: "%s · Córdoba Digital",
  },
  description:
    "Celulares liberados, notebooks, cámaras, drones, consolas y más. Envíos a todo el país por Andreani, hasta 6 cuotas sin interés y retiro en Córdoba Capital.",
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

/**
 * Se ejecuta antes de que se pinte la pagina para que el tema no parpadee.
 *
 * Va como script en linea y no en un componente porque este es el unico punto
 * del ciclo de vida donde el script corre antes del primer pintado: si esperara
 * al hidratado de React, el sitio se veria en claro y despues saltaria a oscuro.
 * Lee la eleccion guardada y, si no hay ninguna, sigue la preferencia del
 * sistema; escribe `<html class="dark">` y actualiza la barra del navegador con
 * `color-scheme`.
 */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("cd-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}var d=t==="dark";document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  type NavNode = {
    slug: string;
    name: string;
    icon: string;
    path: string;
    count: number;
    children?: NavNode[];
  };
  let categories: (NavNode & { tagline: string })[] = [];
  try {
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
    categories = (await getCategoryTree()).map((c) => ({ ...toNavNode(c), tagline: c.tagline }));
  } catch {
    categories = [];
  }

  // Guías de compra para la columna del pie. Si la base no responde, el pie se
  // dibuja sin esa columna: no vale la pena romper todas las páginas por un
  // bloque que es solo un listado de enlaces.
  let guides: GuideTeaser[] = [];
  try {
    guides = await getGuides();
  } catch {
    guides = [];
  }

  return (
    // `suppressHydrationWarning`: el script de arriba cambia la clase de <html>
    // en el cliente, y React se quejaria de que el servidor no la puso.
    <html lang="es-AR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
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
