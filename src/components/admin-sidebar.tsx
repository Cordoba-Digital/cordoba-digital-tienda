"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { PASSWORD_ACTOR_NAME } from "@/lib/admin-actor";

type IconName = "panel" | "pedidos" | "pagos" | "usuarios" | "productos" | "nuevo" | "archivo" | "fotos" | "actividad" | "accesos" | "cupones" | "automatizaciones" | "errores" | "arrepentimientos" | "tienda" | "inicio" | "salir";

const PATHS: Record<IconName, string> = {
  panel: "M4 4v16h16M8 15l3.5-4 3 2.5L20 7",
  nuevo: "M12 5v14M5 12h14",
  pedidos: "M6 7h12l-1 13H7L6 7Zm3 0V6a3 3 0 0 1 6 0v1",
  pagos: "M3 7h18v10H3V7Zm0 4h18M7 15h3",
  cupones: "M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4V7Zm6 3 4 4m0-4h.01M10 14h.01",
  usuarios: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
  productos: "M12 3 4 7v10l8 4 8-4V7l-8-4Zm0 0v18M4 7l8 4 8-4",
  archivo: "M4 5h16v4H4V5Zm1 4v10h14V9M10 13h4",
  fotos: "M4 6h16v12H4V6Zm0 9 4-4 3 3 3-3 6 6M15 9.5h.01",
  actividad: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
  accesos: "M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Zm-3 9 2 2 4-4",
  automatizaciones: "M3 12a5 5 0 0 1 5-5h8a5 5 0 0 1 0 10H8a5 5 0 0 1-5-5Zm13 2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  arrepentimientos: "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
  errores: "M12 4 2.5 20h19L12 4Zm0 6v4m0 3h.01",
  tienda: "M4 10h16l-1-5H5l-1 5Zm1 0v9h14v-9M10 19v-5h4v5",
  inicio: "M4 11 12 4l8 7v9h-5v-6H9v6H4v-9Z",
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
      { href: "/admin/fotos", label: "Fotos del WordPress", icon: "fotos" },
    ],
  },
  {
    title: "Ventas",
    items: [
      { href: "/admin/pedidos", label: "Pedidos", icon: "pedidos" },
      { href: "/admin/pagos", label: "Pagos", icon: "pagos" },
      { href: "/admin/arrepentimientos", label: "Arrepentimientos", icon: "arrepentimientos" },
      { href: "/admin/cupones", label: "Cupones", icon: "cupones" },
    ],
  },
  { title: "Tienda", items: [{ href: "/admin/inicio", label: "Inicio de la tienda", icon: "inicio" }] },
  { title: "Clientes", items: [{ href: "/admin/usuarios", label: "Usuarios", icon: "usuarios" }] },
  {
    title: "Control",
    items: [
      { href: "/admin/automatizaciones", label: "Automatizaciones", icon: "automatizaciones" },
      { href: "/admin/errores", label: "Errores", icon: "errores" },
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
/** `who`: email con el que se entró (vacío si fue con la clave de administrador). */
/**
 * Tres formas según el ancho, para que el panel se use cómodo en cualquier pantalla:
 * - celular (< 768 px): barra arriba y el menú se abre como cajón sobre la página;
 * - tablet o ventana angosta (768 a 1023 px): columna de íconos, con el nombre al pasar el mouse;
 * - escritorio (1024 px o más): barra lateral completa.
 * En pantallas bajas (notebooks de 768 px de alto) los ítems se compactan para que
 * "Ver tienda" y "Salir" no queden fuera de la vista.
 */
export function AdminSidebar({ badges = {}, who = "" }: { badges?: Record<string, number>; who?: string }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const active = activeHref(pathname);

  // Con el cajón abierto: Escape lo cierra y la página de atrás no se desplaza.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  async function logout() {
    setLeaving(true);
    await fetch("/api/admin/login", { method: "DELETE" });
    router.replace("/admin/login");
    router.refresh();
  }

  // En la columna de íconos (md) el texto se oculta y aparece como globo al pasar el mouse.
  const itemCls = (on: boolean) =>
    `group/item relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-[background-color,color,border-color,box-shadow,opacity] duration-150 md:max-lg:justify-center md:max-lg:px-0 md:max-lg:py-2.5 [@media(max-height:820px)]:lg:py-1.5 ${
      on ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
    }`;
  const labelCls =
    "flex-1 md:max-lg:pointer-events-none md:max-lg:absolute md:max-lg:left-full md:max-lg:z-50 md:max-lg:ml-3 md:max-lg:flex-none md:max-lg:whitespace-nowrap md:max-lg:rounded-md md:max-lg:bg-ink-900 md:max-lg:px-2.5 md:max-lg:py-1.5 md:max-lg:text-xs md:max-lg:text-white md:max-lg:opacity-0 md:max-lg:shadow-lg md:max-lg:transition-opacity md:max-lg:group-hover/item:opacity-100 md:max-lg:group-focus-visible/item:opacity-100";

  return (
    <>
      {/* Barra superior solo en celular: abre el menú como cajón. */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-ink-100 bg-surface/95 px-4 py-2.5 backdrop-blur md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="admin-nav"
          aria-label="Abrir menú"
          className="-ml-1.5 grid h-10 w-10 place-items-center rounded-lg text-ink-700 hover:bg-ink-100"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <Link href="/admin" className="flex items-center gap-2">
          <Image src="/images/logo.png" alt="Córdoba Digital" width={80} height={32} className="h-7 w-auto" />
        </Link>
        {/* Mismo ancho que el botón, para que el logo quede centrado. */}
        <span className="relative h-10 w-10">
          {badges["/admin/pedidos"] ? (
            <Link
              href="/admin/pedidos"
              aria-label={`${badges["/admin/pedidos"]} pedidos esperando`}
              className="absolute inset-0 grid place-items-center rounded-lg text-ink-700 hover:bg-ink-100"
            >
              <Icon name="pedidos" />
              <span className="absolute right-0.5 top-0.5 rounded-full bg-brand-700 px-1.5 text-[10px] font-bold leading-4 text-white">
                {badges["/admin/pedidos"]}
              </span>
            </Link>
          ) : null}
        </span>
      </div>

      {/* Fondo oscuro del cajón (solo celular). */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-ink-900/40 transition-opacity duration-200 md:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />

      <aside
        id="admin-nav"
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] border-r border-ink-100 bg-surface shadow-2xl transition-transform duration-200 ease-out md:z-30 md:w-[72px] md:max-w-none md:translate-x-0 md:shadow-none lg:w-60 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col overflow-y-auto px-3 py-4 md:max-lg:overflow-visible md:max-lg:px-2 [@media(max-height:820px)]:py-3">
          <div className="mb-5 flex items-center justify-between px-3 md:max-lg:justify-center md:max-lg:px-0 [@media(max-height:820px)]:mb-3">
            <Link href="/admin" className="flex items-center gap-2" onClick={() => setOpen(false)}>
              <Image src="/images/logo.png" alt="Córdoba Digital" width={96} height={38} className="h-8 w-auto md:max-lg:h-6" />
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar menú"
              className="grid h-9 w-9 place-items-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-900 md:hidden"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <nav aria-label="Administración" className="space-y-5 md:max-lg:space-y-3 [@media(max-height:820px)]:space-y-3">
            {GROUPS.map((group, gi) => (
              <div key={group.title ?? gi} className="space-y-1 md:max-lg:space-y-1.5 [@media(max-height:820px)]:lg:space-y-0.5">
                {group.title ? (
                  <>
                    <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-400 md:max-lg:hidden">{group.title}</p>
                    {/* En la columna de íconos el título del grupo es una rayita. */}
                    <hr className="mx-3 hidden border-ink-100 md:max-lg:block" />
                  </>
                ) : null}
                {group.items.map((item) => {
                  const on = active === item.href;
                  const count = badges[item.href];
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={on ? "page" : undefined}
                      aria-label={count ? `${item.label} (${count})` : undefined}
                      className={itemCls(on)}
                    >
                      <Icon name={item.icon} />
                      <span className={labelCls}>{item.label}</span>
                      {count ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold md:max-lg:absolute md:max-lg:-right-0.5 md:max-lg:-top-0.5 md:max-lg:px-1.5 md:max-lg:py-0 md:max-lg:text-[10px] md:max-lg:leading-4 ${
                            on ? "bg-white text-ink-900" : "bg-brand-700 text-white"
                          }`}
                        >
                          {count}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="mt-6 space-y-1 border-t border-ink-100 pt-4 md:mt-auto [@media(max-height:820px)]:mt-4 [@media(max-height:820px)]:pt-3">
            <p className="truncate px-3 pb-2 text-xs text-ink-500 md:max-lg:hidden" title={who || PASSWORD_ACTOR_NAME}>
              {who || PASSWORD_ACTOR_NAME}
            </p>
            <Link href="/" target="_blank" className={itemCls(false)}>
              <Icon name="tienda" />
              <span className={labelCls}>Ver tienda</span>
            </Link>
            <button type="button" onClick={logout} disabled={leaving} className={`${itemCls(false)} w-full disabled:opacity-50`}>
              <Icon name="salir" />
              <span className={`${labelCls} text-left`}>{leaving ? "Saliendo…" : "Salir"}</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
