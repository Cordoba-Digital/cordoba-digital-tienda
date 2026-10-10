"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { LAST_LIST_KEY } from "@/components/admin-product-filters";

/**
 * "← Volver": a la lista de productos tal como estaba (filtros, orden y
 * página). Si no hay una guardada (link pegado, pestaña nueva), va a `fallback`.
 */
export function AdminBackLink({ fallback }: { fallback: string }) {
  const router = useRouter();
  return (
    <Link
      href={fallback}
      onClick={(e) => {
        let saved: string | null = null;
        try {
          saved = sessionStorage.getItem(LAST_LIST_KEY);
        } catch {}
        if (saved?.startsWith("/admin/") && saved !== fallback) {
          e.preventDefault();
          router.push(saved);
        }
      }}
      className="text-xs font-bold text-brand-700 hover:underline"
    >
      ← Volver
    </Link>
  );
}
