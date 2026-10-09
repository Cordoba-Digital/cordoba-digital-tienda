"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Envuelve el header, el footer y los flotantes de la tienda para ocultarlos en
 * `/admin`, que tiene su propio layout con barra lateral. Usa `usePathname` en
 * el cliente para no volver dinámicas las páginas estáticas de la tienda.
 */
export function StoreChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return null;
  return <>{children}</>;
}
