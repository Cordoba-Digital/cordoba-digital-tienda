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
  wind: (
    <>
      <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" />
      <path d="M9.6 4.6A2 2 0 1 1 11 8H2" />
      <path d="M12.6 19.4A2 2 0 1 0 14 16H2" />
    </>
  ),
  wrench: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-8 8l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 8-8z" />,
  drone: (
    <>
      <circle cx="5" cy="5" r="1.5" />
      <circle cx="19" cy="5" r="1.5" />
      <circle cx="5" cy="19" r="1.5" />
      <circle cx="19" cy="19" r="1.5" />
      <rect x="10" y="10" width="4" height="4" rx="1" />
      <path d="M6.2 6.2 10 10M17.8 6.2 14 10M6.2 17.8 10 14M17.8 17.8 14 14" />
      <path d="M2.5 5h3M18.5 5h3M2.5 19h3M18.5 19h3" />
    </>
  ),
  sofa: (
    <>
      <path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3" />
      <path d="M2 16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v2H6v-2a2 2 0 0 0-4 0z" />
      <path d="M4 18v2M20 18v2" />
    </>
  ),
  zap: <path d="M13 2 3 14h7l-1 8 10-12h-7z" />,
  circuit: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
      <path d="M9 12H6M15 12h3M12 9V6M12 15v3" />
      <circle cx="5" cy="12" r="0.8" />
      <circle cx="19" cy="12" r="0.8" />
      <circle cx="12" cy="5" r="0.8" />
      <circle cx="12" cy="19" r="0.8" />
    </>
  ),
  backpack: (
    <>
      <path d="M4 10V6a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v4" />
      <path d="M4 10h16v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" />
      <path d="M8 10h8" />
      <path d="M8 21v-5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z" />
    </>
  ),
  puzzle: <path d="M14 7V4a2 2 0 0 0-4 0v3H7a2 2 0 0 0-2 2v3h3a2 2 0 1 1 0 4H5v3a2 2 0 0 0 2 2h3v-3a2 2 0 1 1 4 0v3h3a2 2 0 0 0 2-2v-3h-3a2 2 0 1 1 0-4h3V9a2 2 0 0 0-2-2z" />,
  server: (
    <>
      <rect x="2" y="3" width="20" height="7" rx="2" />
      <rect x="2" y="14" width="20" height="7" rx="2" />
      <path d="M6 6.5h.5M6 17.5h.5" />
    </>
  ),
  radio: (
    <>
      <circle cx="12" cy="12" r="2" />
      <path d="M4.9 19.1a10 10 0 0 1 0-14.2M7.8 16.2a6 6 0 0 1 0-8.5M16.2 7.8a6 6 0 0 1 0 8.5M19.1 4.9a10 10 0 0 1 0 14.2" />
    </>
  ),
};

/** Orden importa: lo más específico va primero. */
const RULES: [RegExp, keyof typeof PATHS][] = [
  [/cctv|seguridad|alarma/, "shield"],
  [/aires|climatiz|acondicionad/, "wind"],
  [/accesorio|cargador|cable/, "plug"],
  [/audio|video|auricular|parlante/, "headphones"],
  [/herramienta/, "wrench"],
  [/dron/, "drone"],
  [/camara|lente|foto|gimbal/, "camera"],
  [/impresora|sublimac|3d/, "printer"],
  [/mueble/, "sofa"],
  [/monopatin/, "zap"],
  [/electronica/, "circuit"],
  [/mochila/, "backpack"],
  [/juguete/, "puzzle"],
  [/consola|videojueg|jueg/, "gamepad"],
  [/servidor/, "server"],
  [/handy|handie/, "radio"],
  [/calefac|estufa/, "flame"],
  [/celular|smartwatch|smartband/, "phone"],
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
