export type AdminIconName =
  | "panel"
  | "pedidos"
  | "pagos"
  | "medios"
  | "usuarios"
  | "productos"
  | "nuevo"
  | "archivo"
  | "fotos"
  | "actividad"
  | "accesos"
  | "cupones"
  | "automatizaciones"
  | "errores"
  | "arrepentimientos"
  | "tienda"
  | "inicio"
  | "salir"
  | "buscar"
  | "contraer"
  | "externo"
  | "flecha"
  | "sol"
  | "luna";

/** Trazos de los íconos del panel (24×24, línea de 1,6). */
export const ADMIN_ICON_PATHS: Record<AdminIconName, string> = {
  panel: "M4 4h6v7H4zM14 4h6v4h-6zM14 12h6v8h-6zM4 15h6v5H4z",
  sol: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  luna: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z",
  nuevo: "M12 8v8M8 12h8M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
  pedidos: "M5 7h14l-1 13H6L5 7Zm4 0V6a3 3 0 0 1 6 0v1M9 11a3 3 0 0 0 6 0",
  pagos: "M3 6h18v12H3zM3 10h18M7 15h3",
  medios: "M3 10 12 4l9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18",
  cupones: "M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4V7Zm6 3 4 4m0-4h.01M10 14h.01",
  usuarios: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-6 9a6 6 0 0 1 12 0M16 3.5a4 4 0 0 1 0 7.5M21 20a6 6 0 0 0-3-5.2",
  productos: "M12 3 4 7v10l8 4 8-4V7l-8-4Zm0 0v18M4 7l8 4 8-4",
  archivo: "M3 4h18v4H3zM5 8v12h14V8M10 12h4",
  fotos: "M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6M15.5 9h.01",
  actividad: "M3 12h4l3-8 4 16 3-8h4",
  accesos: "M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Zm-3 9 2 2 4-4",
  automatizaciones: "M13 2 4 14h7l-1 8 9-12h-7l1-8Z",
  arrepentimientos: "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
  errores: "M12 4 2.5 20h19L12 4Zm0 6v4m0 3h.01",
  tienda: "M3 9l1.5-5h15L21 9M3 9h18M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M5 12v8h14v-8M10 20v-5h4v5",
  inicio: "M3 11 12 3l9 8M5 9.5V20h14V9.5M10 20v-6h4v6",
  salir: "M10 4H5v16h5M14 8l4 4-4 4M18 12H9",
  buscar: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm10 3-4.3-4.3",
  contraer: "M3 5h18v14H3zM9 5v14",
  externo: "M7 17 17 7M8 7h9v9",
  flecha: "m9 6 6 6-6 6",
};

export type AdminNavItem = { href: string; label: string; icon: AdminIconName };

/** Agrupado por tarea: catálogo primero, que es lo que más se usa. */
export const ADMIN_NAV_GROUPS: { title?: string; items: AdminNavItem[] }[] = [
  { items: [{ href: "/admin", label: "Panel", icon: "panel" }] },
  {
    title: "Catálogo",
    items: [
      { href: "/admin/productos", label: "Productos", icon: "productos" },
      { href: "/admin/productos/nuevo", label: "Nuevo producto", icon: "nuevo" },
      { href: "/admin/productos/archivados", label: "Archivados", icon: "archivo" },
      { href: "/admin/fotos", label: "Fotos", icon: "fotos" },
    ],
  },
  {
    title: "Ventas",
    items: [
      { href: "/admin/pedidos", label: "Pedidos", icon: "pedidos" },
      { href: "/admin/pagos", label: "Pagos", icon: "pagos" },
      { href: "/admin/medios-de-pago", label: "Medios de pago", icon: "medios" },
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

export const ADMIN_NAV: AdminNavItem[] = ADMIN_NAV_GROUPS.flatMap((g) => g.items);

/** Evento que abre el buscador del panel desde cualquier pantalla. */
export const ADMIN_SEARCH_EVENT = "admin:buscar";

/** Cookie con la preferencia de la barra lateral en la compu (completa o compacta). */
export const ADMIN_NAV_COOKIE = "admin_nav";

/** Cookie con el tema del panel: "claro" u "oscuro" (sin cookie, claro). */
export const ADMIN_THEME_COOKIE = "admin_tema";
export type AdminTheme = "claro" | "oscuro";
