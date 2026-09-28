import type { Metadata } from "next";
import type { ReactNode } from "react";

import { CartDrawer, Toaster } from "@/components/cart-drawer";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { StoreProvider } from "@/components/store-provider";
import { WhatsAppFab } from "@/components/whatsapp-fab";
import { getCategories } from "@/lib/queries";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.cordobadigital.net"),
  title: {
    default: "Córdoba Digital · Tecnología con garantía y envíos a todo el país",
    template: "%s · Córdoba Digital",
  },
  description:
    "Celulares liberados, notebooks, cámaras, drones, consolas y más. 15% OFF con transferencia, hasta 6 cuotas sin interés, envío gratis desde $250.000 y retiro en Córdoba Capital.",
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
      "La tienda de tecnología de Córdoba: envíos a todo el país, 15% OFF con transferencia y soporte post-venta real.",
    images: [{ url: "/images/logo.png", alt: "Córdoba Digital" }],
  },
  icons: {
    icon: "/images/logo.png",
    apple: "/images/logo.png",
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  let categories: { slug: string; name: string; icon: string; tagline: string }[] = [];
  try {
    categories = (await getCategories()).map((c) => ({
      slug: c.slug,
      name: c.name,
      icon: c.icon,
      tagline: c.tagline,
    }));
  } catch {
    categories = [];
  }

  return (
    <html lang="es-AR">
      <body className="min-h-screen bg-ink-50 text-ink-900 antialiased">
        <StoreProvider>
          <SiteHeader categories={categories} />
          <main className="min-h-[60vh]">{children}</main>
          <SiteFooter />
          <CartDrawer />
          <Toaster />
          <WhatsAppFab />
        </StoreProvider>
      </body>
    </html>
  );
}
