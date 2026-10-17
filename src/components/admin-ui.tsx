import type { CSSProperties, ReactNode } from "react";

import { statusLabel } from "@/lib/pricing";

/** Colores por estado del pedido, los mismos del diseño del panel. */
const STATUS_COLORS: Record<string, string> = {
  pendiente_pago: "#f5b544",
  pago_confirmado: "#3dd6b0",
  preparando: "#7fb0ff",
  enviado: "#b79cff",
  entregado: "#6ee79a",
  cancelado: "#ff8a8a",
};

export function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? "#b4b8c0";
}

/** Etiqueta del estado de un pedido: punto y texto del color del estado. */
export function AdminStatusBadge({ status, className = "" }: { status: string; className?: string }) {
  const color = statusColor(status);
  return (
    <span
      className={`adm-badge inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-[3px] text-xs font-medium ${className}`}
      style={{ "--c": color } as CSSProperties}
    >
      <i className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {statusLabel(status)}
    </span>
  );
}

/** Etiqueta con punto de color para otros estados (stock, pagos, etc.). */
export function AdminDotBadge({ color, children, className = "" }: { color: string; children: ReactNode; className?: string }) {
  return (
    <span
      className={`adm-badge inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-[3px] text-xs font-medium ${className}`}
      style={{ "--c": color } as CSSProperties}
    >
      <i className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}

const AVATAR_COLORS = ["#f59a6b", "#6fd3a5", "#7fb0ff", "#b79cff", "#f5c46b", "#ff8a8a"];

/** Círculo con las iniciales del cliente; el color sale del nombre, así siempre es el mismo. */
export function AdminAvatar({ name, size = 36 }: { name: string; size?: number }) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = ((words[0]?.[0] ?? "?") + (words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "")).toUpperCase();
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full font-bold text-[#14161c] shadow-[0_0_0_3px_rgb(255_255_255/0.06)]"
      style={{ width: size, height: size, fontSize: size * 0.36, backgroundColor: AVATAR_COLORS[hash % AVATAR_COLORS.length] }}
    >
      {initials}
    </span>
  );
}

/** Encabezado de cada pantalla: sección arriba en gris, título y acciones a la derecha. */
export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end gap-4">
      <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
        {eyebrow ? <span className="text-[13px] text-adm-muted">{eyebrow}</span> : null}
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] text-adm-fg sm:text-[30px]">{title}</h1>
        {description ? <p className="text-sm text-adm-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
    </header>
  );
}

/** Botón principal naranja del diseño. */
export const adminBtn =
  "inline-flex h-10 items-center gap-2 rounded-full bg-[linear-gradient(180deg,#ff7440,#f15a24)] px-4 text-sm font-semibold text-[#14161c] shadow-[inset_0_1px_0_rgb(255_255_255/0.4),0_10px_24px_-10px_rgb(241_90_36/0.7)] transition-[filter,translate] duration-150 hover:brightness-110 active:translate-y-px";

/** Botón secundario (pastilla translúcida). */
export const adminChip =
  "inline-flex h-10 items-center gap-2 rounded-full border border-adm-fg/10 bg-adm-fg/[0.05] px-3.5 text-[13px] text-adm-soft transition-[background-color] duration-150 hover:bg-adm-fg/[0.09]";

/** Enlace naranja de "Ver todos" en los títulos de las tarjetas. */
export const adminLink = "ml-auto inline-flex items-center gap-1 text-[13px] text-adm-accent hover:text-adm-accent";
