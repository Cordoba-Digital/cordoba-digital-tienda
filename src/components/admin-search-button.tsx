"use client";

import { AdminIcon } from "@/components/admin-icon";
import { ADMIN_SEARCH_EVENT } from "@/components/admin-nav-items";

/** Caja de búsqueda de la barra superior: abre el buscador del panel. */
export function AdminSearchButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(ADMIN_SEARCH_EVENT))}
      className="flex h-10 max-w-[460px] flex-[1_1_320px] items-center gap-2.5 rounded-full border border-adm-fg/10 bg-adm-fg/[0.04] px-3.5 text-left text-sm text-adm-faint transition-[background-color] duration-150 hover:bg-adm-fg/[0.07]"
    >
      <AdminIcon name="buscar" />
      <span className="flex-1 truncate">Buscar pedidos, productos o clientes…</span>
    </button>
  );
}
