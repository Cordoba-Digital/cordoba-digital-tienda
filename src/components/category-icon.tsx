import type { ComponentType } from "react";
import {
  AirVent,
  Backpack,
  Cable,
  Camera,
  Cctv,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Drone,
  Gamepad2,
  Headphones,
  Flame,
  Heater,
  Joystick,
  Laptop,
  LayoutGrid,
  Lock,
  Monitor,
  Package,
  Printer,
  Radio,
  Refrigerator,
  Scooter,
  Search,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Snowflake,
  Sofa,
  ToyBrick,
  Truck,
  Tv,
  Wifi,
  Wrench,
  X,
  Zap,
  type LucideProps,
} from "lucide-react";

/**
 * La clave sale del NOMBRE de la categoría, no del emoji guardado, así
 * "Accesorios P/ Celulares" y "Cámaras CCTV" ya no repiten icono. Los
 * componentes son de `lucide-react` (tree-shakeable: solo estos entran al
 * bundle); la API (`Icon`, `CategoryIcon`, `categoryIconKey`) no cambió.
 */
const ICONS: Record<string, ComponentType<LucideProps>> = {
  phone: Smartphone,
  plug: Cable,
  headphones: Headphones,
  laptop: Laptop,
  camera: Camera,
  shield: ShieldCheck,
  cctv: Cctv,
  gamepad: Gamepad2,
  joystick: Joystick,
  tv: Tv,
  monitor: Monitor,
  appliance: Refrigerator,
  snow: Snowflake,
  printer: Printer,
  wifi: Wifi,
  truck: Truck,
  lock: Lock,
  flame: Flame,
  heater: Heater,
  check: Check,
  search: Search,
  sliders: SlidersHorizontal,
  x: X,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  chevronDown: ChevronDown,
  grid: LayoutGrid,
  box: Package,
  wind: AirVent,
  wrench: Wrench,
  drone: Drone,
  sofa: Sofa,
  zap: Zap,
  scooter: Scooter,
  circuit: Cpu,
  cpu: Cpu,
  backpack: Backpack,
  puzzle: ToyBrick,
  server: Server,
  radio: Radio,
};

/** Orden importa: lo más específico va primero. */
const RULES: [RegExp, keyof typeof ICONS][] = [
  [/cctv|seguridad|alarma/, "cctv"],
  [/aires|climatiz|acondicionad/, "wind"],
  [/accesorio|cargador|cable/, "plug"],
  [/audio|video|auricular|parlante/, "headphones"],
  [/herramienta/, "wrench"],
  [/dron/, "drone"],
  [/camara|lente|foto|gimbal/, "camera"],
  [/impresora|sublimac|3d/, "printer"],
  [/mueble/, "sofa"],
  [/monopatin/, "scooter"],
  [/electronica/, "cpu"],
  [/mochila/, "backpack"],
  [/juguete/, "puzzle"],
  [/consola|videojueg|jueg/, "gamepad"],
  // Va después de `gamepad` para que "Consolas" gane y "Gaming" caiga acá.
  [/gaming|gamer/, "joystick"],
  [/servidor/, "server"],
  [/handy|handie/, "radio"],
  [/calefac|estufa/, "heater"],
  [/celular|smartwatch|smartband/, "phone"],
  [/televis|proyector|pantalla/, "tv"],
  [/conectividad|router|wifi|red\b/, "wifi"],
  [/electrodomestic|freidora|cafetera|heladera|lavarropas|microondas/, "appliance"],
  [/notebook|comput|monitor|tablet|perifer|component/, "laptop"],
];

export function categoryIconKey(name: string): string {
  const n = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return RULES.find(([re]) => re.test(n))?.[1] ?? "box";
}

export function Icon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
  const Cmp = ICONS[name] ?? ICONS.box;
  return <Cmp className={className} strokeWidth={1.8} aria-hidden="true" />;
}

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  return <Icon name={categoryIconKey(name)} className={className} />;
}
