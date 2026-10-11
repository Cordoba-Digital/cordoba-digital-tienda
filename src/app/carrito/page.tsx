import type { Metadata } from "next";

import { CartView } from "@/components/cart-view";
import { toView } from "@/lib/product-view";
import { getBestSellers } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Carrito de compras",
  description: "Revisá tu carrito y finalizá tu compra con envío a todo el país.",
  // Página personal: sin contenido propio para el buscador.
  robots: { index: false, follow: true },
};

export default async function CartPage() {
  const suggestions = await getBestSellers(6);
  return <CartView suggestions={suggestions.map(toView)} />;
}
