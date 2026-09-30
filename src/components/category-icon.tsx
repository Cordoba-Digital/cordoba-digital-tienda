import type { ReactNode } from "react";

/**
 * Íconos de línea (estilo Lucide, 24x24) para reemplazar los emojis de las
 * categorías. La clave sale del NOMBRE de la categoría, no del emoji guardado,
 * así "Accesorios P/ Celulares" y "Cámaras CCTV" ya no repiten 📱 y 📷.
 */
const PATHS: Record<string, ReactNode> = {
  phone: (
    <>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </>
  ),
  plug: <path d="M9 2v5M15 2v5M6 7h12v4a6 6 0 01-12 0zM12 17v5" />,
  headphones: (
    <>
      <path d="M4 15v-3a8 8 0 0116 0v3" />
      <rect x="3" y="14" width="4" height="6" rx="1.5" />
      <rect x="17" y="14" width="4" height="6" rx="1.5" />
    </>
  ),
  laptop: (
    <>
      <rect x="4" y="5" width="16" height="11" rx="1.5" />
      <path d="M2 20h20" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  gamepad: (
    <>
      <rect x="2" y="7" width="20" height="11" rx="5" />
      <path d="M7 10v5M4.5 12.5h5M16 11.5h.01M18 13.5h.01" />
    </>
  ),
  tv: (
    <>
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </>
  ),
  appliance: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <rect x="6" y="9" width="8" height="6" rx="1" />
      <path d="M17 10h1M17 14h1" />
    </>
  ),
  snow: <path d="M12 2v20M4 7l16 10M20 7L4 17" />,
  printer: (
    <>
      <path d="M7 9V3h10v6" />
      <rect x="4" y="9" width="16" height="8" rx="2" />
      <path d="M7 14h10v7H7z" />
    </>
  ),
  wifi: (
    <>
      <path d="M2 9a15 15 0 0120 0M5 12.5a10.5 10.5 0 0114 0M8.5 16a5.5 5.5 0 017 0" />
      <path d="M12 19.5h.01" />
    </>
  ),
  truck: (
    <>
      <path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z" />
      <circle cx="7" cy="18" r="1.6" />
      <circle cx="17.5" cy="18" r="1.6" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </>
  ),
  flame: <path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 01-10 0c0-2 1-3.5 2-4.5.3 1.5 1 2.3 2 2.5C11 8 11 5.5 12 3z" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.2-3.2" />
    </>
  ),
  sliders: <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  chevronLeft: <path d="M15 5l-7 7 7 7" />,
  chevronRight: <path d="M9 5l7 7-7 7" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  grid: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />,
  box: (
    <>
      <path d="M21 8l-9-5-9 5v8l9 5 9-5z" />
      <path d="M3 8l9 5 9-5M12 13v8" />
    </>
  ),
};

/** Orden importa: lo más específico va primero. */
const RULES: [RegExp, keyof typeof PATHS][] = [
  [/cctv|seguridad|alarma/, "shield"],
  [/aires|climatiz|acondicionad/, "snow"],
  [/accesorio|cargador|cable/, "plug"],
  [/audio|video|auricular|parlante/, "headphones"],
  [/celular|smartwatch|smartband/, "phone"],
  [/camara|lente|foto|dron|gimbal/, "camera"],
  [/impresora|sublimac|3d/, "printer"],
  [/consola|videojueg|jueg/, "gamepad"],
  [/televis|proyector|pantalla/, "tv"],
  [/conectividad|router|wifi|red\b/, "wifi"],
  [/electrodomestic|freidora|cafetera|heladera|lavarropas|microondas/, "appliance"],
  [/notebook|comput|monitor|tablet|perifer|component/, "laptop"],
];

export function categoryIconKey(name: string): string {
  const n = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return RULES.find(([re]) => re.test(n))?.[1] ?? "box";
}

export function Icon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name] ?? PATHS.box}
    </svg>
  );
}

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  return <Icon name={categoryIconKey(name)} className={className} />;
}
