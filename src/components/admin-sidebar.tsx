"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

type IconName = "panel" | "pedidos" | "pagos" | "usuarios" | "productos" | "nuevo" | "archivo" | "actividad" | "accesos" | "tienda" | "salir";

const PATHS: Record<IconName, string> = {
  panel: "M4 4v16h16M8 15l3.5-4 3 2.5L20 7",
  nuevo: "M12 5v14M5 12h14",
  pedidos: "M6 7h12l-1 13H7L6 7Zm3 0V6a3 3 0 0 1 6 0v1",
  pagos: "M3 7h18v10H3V7Zm0 4h18M7 15h3",
  usuarios: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
  productos: "M12 3 4 7v10l8 4 8-4V7l-8-4Zm0 0v18M4 7l8 4 8-4",
  archivo: "M4 5h16v4H4V5Zm1 4v10h14V9M10 13h4",
  actividad: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
  accesos: "M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Zm-3 9 2 2 4-4",
  tienda: "M4 10h16l-1-5H5l-1 5Zm1 0v9h14v-9M10 19v-5h4v5",
  salir: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10",
};

function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name]} />
    </svg>
  );
}

type NavItem = { href: string; label: string; icon: IconName };

/** Agrupado por tarea: catálogo primero, que es lo que más se usa. */
const GROUPS: { title?: string; items: NavItem[] }[] = [
  { items: [{ href: "/admin", label: "Panel", icon: "panel" }] },
  {
    title: "Catálogo",
    items: [
      { href: "/admin/productos", label: "Productos", icon: "productos" },
      { href: "/admin/productos/nuevo", label: "Nuevo producto", icon: "nuevo" },
      { href: "/admin/productos/archivados", label: "Archivados", icon: "archivo" },
    ],
  },
  {
    title: "Ventas",
    items: [
      { href: "/admin/pedidos", label: "Pedidos", icon: "pedidos" },
      { href: "/admin/pagos", label: "Pagos", icon: "pagos" },
    ],
  },
  { title: "Clientes", items: [{ href: "/admin/usuarios", label: "Usuarios", icon: "usuarios" }] },
  {
    title: "Control",
    items: [
      { href: "/admin/actividad", label: "Actividad", icon: "actividad" },
      { href: "/admin/accesos", label: "Accesos", icon: "accesos" },
    ],
  },
];

const NAV = GROUPS.flatMap((g) => g.items);

/** La entrada activa es la de prefijo más largo (Archivados gana a Productos). */
function activeHref(pathname: string): string {
  const matches = NAV.filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  return matches.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? "";
}

/** `badges`: contador por sección (pedidos esperando pago, por ejemplo). */
/** `who`: email con el que se entró (vacío si fue con la contraseña). */
export function AdminSidebar({ badges = {}, who = "" }: { badges?: Record<string, number>; who?: string }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const active = activeHref(pathname);

  async function logout() {
    setLeaving(true);
    await fetch("/api/admin/login", { method: "DELETE" });
    router.replace("/admin/login");
    router.refresh();
  }

  const itemCls = (on: boolean) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition ${
      on ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
    }`;

  return (
    <>
      {/* Barra superior solo en celular: abre el menú lateral. */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-ink-100 bg-surface px-4 py-3 lg:hidden">
        <Link href="/admin" className="flex items-center gap-2">
          <Image src="/images/logo.png" alt="Córdoba Digital" width={80} height={32} className="h-7 w-auto" />
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-ink-500">Admin</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="admin-nav"
          className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-bold text-ink-700"
        >
          {open ? "Cerrar" : "Menú"}
        </button>
      </div>

      <aside
        id="admin-nav"
        className={`${open ? "block" : "hidden"} border-b border-ink-100 bg-surface lg:fixed lg:inset-y-0 lg:left-0 lg:block lg:w-60 lg:border-b-0 lg:border-r`}
      >
        <div className="flex h-full flex-col overflow-y-auto px-3 py-4">
          <Link href="/admin" className="mb-6 hidden items-center gap-2 px-3 lg:flex">
            <Image src="/images/logo.png" alt="Córdoba Digital" width={96} height={38} className="h-8 w-auto" />
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-500">Admin</span>
          </Link>
          <nav aria-label="Administración" className="space-y-5">
            {GROUPS.map((group, gi) => (
              <div key={group.title ?? gi} className="space-y-1">
                {group.title ? (
                  <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-400">{group.title}</p>
                ) : null}
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active === item.href ? "page" : undefined}
                    className={itemCls(active === item.href)}
                  >
                    <Icon name={item.icon} />
                    <span className="flex-1">{item.label}</span>
                    {badges[item.href] ? (
                      <span
                        title="Pedidos esperando pago"
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${active === item.href ? "bg-white text-ink-900" : "bg-brand-700 text-white"}`}
                      >
                        {badges[item.href]}
                      </span>
                    ) : null}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
          <div className="mt-6 space-y-1 border-t border-ink-100 pt-4 lg:mt-auto">
            <p className="truncate px-3 pb-2 text-xs text-ink-500" title={who || "Ingreso con contraseña"}>
              {who || "Ingreso con contraseña"}
            </p>
            <Link href="/" target="_blank" className={itemCls(false)}>
              <Icon name="tienda" />
              Ver tienda
            </Link>
            <button type="button" onClick={logout} disabled={leaving} className={`${itemCls(false)} w-full disabled:opacity-50`}>
              <Icon name="salir" />
              {leaving ? "Saliendo…" : "Salir"}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
