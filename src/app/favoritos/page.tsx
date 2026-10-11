import type { Metadata } from "next";

import { FavoritesView } from "@/components/favorites-view";
import { toView } from "@/lib/product-view";
import { listProducts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mis favoritos",
  description: "Los productos que guardaste para comparar y comprar después.",
  // Página personal: sin contenido propio para el buscador.
  robots: { index: false, follow: true },
};

export default async function FavoritesPage() {
  const { items } = await listProducts({ perPage: 100 });
  return (
    <div className="container-xl py-8">
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-ink-900 md:text-3xl">Mis favoritos</h1>
      <p className="mb-6 text-sm text-ink-500">Guardamos tu lista en este dispositivo, sin necesidad de crear cuenta.</p>
      <FavoritesView products={items.map(toView)} />
    </div>
  );
}
