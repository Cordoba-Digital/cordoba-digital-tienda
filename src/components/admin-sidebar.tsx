"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import { AdminIcon } from "@/components/admin-icon";
import { ADMIN_NAV, ADMIN_NAV_COOKIE, ADMIN_NAV_GROUPS, ADMIN_SEARCH_EVENT, ADMIN_THEME_COOKIE, type AdminTheme } from "@/components/admin-nav-items";
import { AdminSearchPalette } from "@/components/admin-search-palette";
import { PASSWORD_ACTOR_NAME } from "@/lib/admin-actor";

/** La entrada activa es la de prefijo más largo (Archivados gana a Productos). */
function activeHref(pathname: string): string {
  const matches = ADMIN_NAV.filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  return matches.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? "";
}

/** Color del contador: errores en rojo, pagos en ámbar, el resto neutro. */
const BADGE_TONE: Record<string, "warn" | "err" | undefined> = {
  "/admin/pagos": "warn",
  "/admin/errores": "err",
};

function badgeCls(href: string, on: boolean): string {
  if (on) return "bg-brand-500 text-[#14161c]";
  const tone = BADGE_TONE[href];
  if (tone === "err") return "bg-[#ff6a6a]/20 text-adm-red";
  if (tone === "warn") return "bg-adm-amber/15 text-adm-amber";
  return "bg-adm-fg/10 text-adm-soft";
}

/**
 * Marco del panel: barra lateral + contenido. Tres formas según el ancho:
 * - celular (< 768 px): barra arriba y el menú se abre como cajón sobre la página;
 * - tablet (768 a 1023 px): columna de íconos, con el nombre al pasar el mouse;
 * - compu (1024 px o más): barra lateral completa, que se puede contraer a íconos.
 * `badges`: contador por sección. `who`: email con el que se entró (vacío si fue con la clave).
 */
export function AdminFrame({
  badges = {},
  who = "",
  compact: initialCompact = false,
  tema: initialTema = "oscuro",
  children,
}: {
  badges?: Record<string, number>;
  who?: string;
  compact?: boolean;
  tema?: AdminTheme;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(initialCompact);
  const [leaving, setLeaving] = useState(false);
  const [tema, setTema] = useState<AdminTheme>(initialTema);
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

  function toggleCompact() {
    const next = !compact;
    setCompact(next);
    document.cookie = `${ADMIN_NAV_COOKIE}=${next ? "compacto" : "completo"}; path=/admin; max-age=31536000; samesite=lax`;
  }

  // El tema se aplica en el contenedor del layout; la cookie lo recuerda para la próxima carga.
  function toggleTema() {
    const next: AdminTheme = tema === "claro" ? "oscuro" : "claro";
    setTema(next);
    document.querySelector(".admin-theme")?.setAttribute("data-tema", next);
    document.cookie = `${ADMIN_THEME_COOKIE}=${next}; path=/admin; max-age=31536000; samesite=lax`;
  }

  function openSearch() {
    setOpen(false);
    window.dispatchEvent(new Event(ADMIN_SEARCH_EVENT));
  }

  async function logout() {
    setLeaving(true);
    await fetch("/api/admin/login", { method: "DELETE" });
    router.replace("/admin/login");
    router.refresh();
  }

  const name = who || PASSWORD_ACTOR_NAME;
  const initial = (who || "A").charAt(0).toUpperCase();

  // En la columna de íconos el texto se oculta y aparece como globo al pasar el mouse.
  const itemCls = (on: boolean) =>
    `group/item relative flex items-center gap-2.5 rounded-[10px] px-2.5 py-[7px] text-sm transition-[background-color,color,box-shadow] duration-150 rail:justify-center rail:px-0 roomy:py-1 short:py-[3px] tiny:py-0.5 tiny:text-[13px] ${
      on
        ? "bg-[linear-gradient(90deg,rgb(241_90_36/0.2),rgb(241_90_36/0.06))] text-adm-fg shadow-[inset_0_0_0_1px_rgb(241_90_36/0.32)] before:absolute before:-left-3.5 before:inset-y-2 before:w-[3px] before:rounded-r before:bg-brand-500 rail:before:-left-2"
        : "text-adm-muted hover:bg-adm-fg/[0.06] hover:text-adm-fg"
    }`;
  const labelCls =
    "flex-1 truncate rail:pointer-events-none rail:absolute rail:left-full rail:z-50 rail:ml-3 rail:flex-none rail:whitespace-nowrap rail:rounded-md rail:border rail:border-adm-fg/10 rail:bg-adm-panel rail:px-2.5 rail:py-1.5 rail:text-xs rail:text-adm-fg rail:opacity-0 rail:shadow-lg rail:transition-opacity rail:group-hover/item:opacity-100 rail:group-focus-visible/item:opacity-100";

  return (
    <div data-nav={compact ? "compacto" : "completo"} className="min-h-screen">
      {/* Barra superior solo en celular: abre el menú como cajón. */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-adm-fg/[0.08] bg-adm-bg/90 px-4 py-2.5 backdrop-blur md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="admin-nav"
          aria-label="Abrir menú"
          className="-ml-1.5 grid h-10 w-10 place-items-center rounded-lg text-adm-soft hover:bg-adm-fg/[0.06]"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <Link href="/admin" className="flex items-center gap-2 text-[15px] font-semibold text-adm-fg">
          <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[linear-gradient(135deg,#ff8a5b,#f15a24)] text-[13px] font-bold text-[#14161c]">CD</span>
          Córdoba Digital
        </Link>
        <button
          type="button"
          onClick={openSearch}
          aria-label="Buscar"
          className="grid h-10 w-10 place-items-center rounded-lg text-adm-soft hover:bg-adm-fg/[0.06]"
        >
          <AdminIcon name="buscar" className="h-5 w-5" />
        </button>
      </div>

      {/* Fondo oscuro del cajón (solo celular). */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-200 md:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />

      <aside
        id="admin-nav"
        className={`fixed inset-y-0 left-0 z-50 w-[272px] max-w-[85vw] border-r border-adm-fg/[0.08] bg-adm-panel transition-[transform,width] duration-200 ease-out md:z-30 md:w-[248px] md:max-w-none md:translate-x-0 md:bg-[linear-gradient(180deg,rgb(255_255_255/0.045),rgb(255_255_255/0.02))] md:backdrop-blur-xl rail:w-[72px] ${
          open ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col gap-[18px] overflow-y-auto px-3.5 py-5 rail:overflow-visible rail:cramped:overflow-y-auto rail:px-2.5 roomy:gap-3 roomy:py-3.5 short:gap-2 short:py-2.5">
          <div className="flex items-center gap-2.5 px-1.5 rail:flex-col rail:gap-2 rail:px-0">
            <Link href="/admin" onClick={() => setOpen(false)} className="flex min-w-0 items-center gap-2.5" aria-label="Panel de Córdoba Digital">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[linear-gradient(135deg,#ff8a5b,#f15a24)] text-sm font-bold text-[#14161c] shadow-[0_6px_18px_-6px_rgb(241_90_36/0.7),inset_0_1px_0_rgb(255_255_255/0.4)]">
                CD
              </span>
              <span className="flex min-w-0 flex-col leading-tight rail:hidden">
                <span className="truncate text-[15px] font-semibold text-adm-fg">Córdoba Digital</span>
                <span className="truncate text-xs text-adm-faint">Panel de administración</span>
              </span>
            </Link>
            <button
              type="button"
              onClick={toggleCompact}
              aria-label={compact ? "Expandir menú" : "Contraer menú"}
              aria-pressed={compact}
              title={compact ? "Expandir menú" : "Contraer menú"}
              className="ml-auto hidden h-7 w-7 shrink-0 place-items-center rounded-lg border border-adm-fg/10 bg-adm-fg/[0.04] text-adm-muted hover:bg-adm-fg/[0.08] hover:text-adm-fg lg:grid rail:ml-0"
            >
              <AdminIcon name="contraer" className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar menú"
              className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-adm-muted hover:bg-adm-fg/[0.06] hover:text-adm-fg md:hidden"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          <button
            type="button"
            onClick={openSearch}
            className="group/item relative flex h-[38px] shrink-0 items-center tiny:h-8 text-left gap-2.5 rounded-xl border border-adm-fg/[0.09] bg-adm-fg/[0.04] px-3 text-[13px] text-adm-muted hover:bg-adm-fg/[0.07] hover:text-adm-fg rail:justify-center rail:px-0"
          >
            <AdminIcon name="buscar" className="h-4 w-4" />
            <span className={labelCls}>Buscar…</span>
          </button>

          <nav aria-label="Administración" className="flex flex-col gap-3.5 rail:gap-2 roomy:gap-2 short:gap-1.5 tiny:gap-1">
            {ADMIN_NAV_GROUPS.map((group, gi) => (
              <div key={group.title ?? gi} className="flex flex-col gap-0.5 rail:gap-1">
                {group.title ? (
                  <>
                    <p className="px-2.5 pb-1.5 text-[11px] uppercase tracking-[0.08em] text-adm-faint rail:hidden short:hidden">{group.title}</p>
                    {/* En la columna de íconos (y en ventanas bajas) el título del grupo es una rayita. */}
                    <hr className="mx-2 hidden border-adm-fg/[0.08] rail:block short:mb-1 short:block" />
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
                      <span className={on ? "text-adm-accent" : ""}>
                        <AdminIcon name={item.icon} />
                      </span>
                      <span className={labelCls}>{item.label}</span>
                      {count ? (
                        <span
                          className={`ml-auto min-w-5 rounded-full px-[7px] py-0.5 text-center text-[11px] font-semibold tabular-nums rail:absolute rail:-right-1 rail:-top-1 rail:min-w-0 rail:px-1.5 rail:py-0 rail:text-[10px] rail:leading-4 ${badgeCls(item.href, on)}`}
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

          <div className="mt-auto flex flex-col gap-2.5 border-t border-adm-fg/[0.08] pt-4 roomy:pt-3 short:gap-1.5 short:pt-2">
            <Link href="/" target="_blank" className={itemCls(false)}>
              <AdminIcon name="tienda" />
              <span className={labelCls}>Ver la tienda</span>
              <span className="text-adm-faint rail:hidden">
                <AdminIcon name="externo" className="h-3.5 w-3.5" />
              </span>
            </Link>
            <div className="flex items-center gap-2.5 rounded-xl border border-adm-fg/[0.08] bg-adm-fg/[0.04] p-2.5 short:p-1.5 rail:flex-col rail:gap-0.5 rail:border-0 rail:bg-transparent rail:p-0">
              <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full rail:hidden bg-[linear-gradient(135deg,#ff8a5b,#f15a24)] text-[13px] font-bold text-[#14161c]" title={name}>
                {initial}
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-adm-panel bg-[#3dd6b0]" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-1 flex-col leading-tight rail:hidden">
                <span className="truncate text-[13px] font-medium text-adm-fg" title={name}>{name}</span>
                <span className="text-xs text-adm-faint">Administrador</span>
              </span>
              <button
                type="button"
                onClick={toggleTema}
                aria-label={tema === "claro" ? "Pasar al tema oscuro" : "Pasar al tema claro"}
                title={tema === "claro" ? "Tema oscuro" : "Tema claro"}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-adm-muted hover:bg-adm-fg/[0.08] hover:text-adm-fg"
              >
                <AdminIcon name={tema === "claro" ? "luna" : "sol"} />
              </button>
              <button
                type="button"
                onClick={logout}
                disabled={leaving}
                aria-label={leaving ? "Saliendo…" : "Salir"}
                title="Salir"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-adm-muted hover:bg-adm-fg/[0.08] hover:text-adm-fg disabled:opacity-50"
              >
                <AdminIcon name="salir" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* El contenido acompaña el ancho: más aire en monitores grandes sin que las tablas queden angostas. */}
      <div className="transition-[padding] duration-200 md:pl-[72px] wide:pl-[248px]">
        <main className="admin-shell mx-auto max-w-6xl px-4 py-5 sm:px-6 md:py-6 lg:px-9 lg:py-6 xl:max-w-7xl 2xl:max-w-[1440px] 2xl:px-10">{children}</main>
      </div>

      <AdminSearchPalette />
    </div>
  );
}
