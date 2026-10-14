/**
 * Marca de un producto a partir de su nombre, para los que vinieron de
 * WooCommerce sin marca (quedaron como "General"). Sin marca, el producto no
 * aparece en los filtros ni en los atajos del buscador ("Monopatines
 * Eléctricos Daihatsu").
 *
 * Se toma la marca que aparece primero en el nombre, como palabra entera. La
 * forma escrita en `MARCAS` (o la que ya usa el catálogo) es la que se guarda.
 */

/** Lo que pone el migrador cuando WooCommerce no trae marca. */
export const FALLBACK_BRAND = "General";

/** Marcas conocidas del rubro. Se suman a las que ya tiene el catálogo. */
export const MARCAS = [
  // Climatización y electrodomésticos
  "Samsung", "Hisense", "BGH", "Kanji", "Peabody", "Philco", "Surrey", "Midea", "LG", "Liliana",
  "Atma", "Electrolux", "TCL", "Noblex", "Gree", "Carrier", "York", "Whirlpool", "Axel",
  "Ultracomb", "Punktal", "Daewoo", "Westinghouse", "Sansei", "Siam", "Coventry", "Electra",
  "Telefunken", "Candy", "Enova", "Necchi", "Winco", "Smartlife", "Yelmo", "Magiclick", "Kacemaster",
  "Embassy", "Oryx", "Alpaca", "Hitachi", "Hyundai", "Philips", "Oster", "Moulinex", "Ariston",
  "Drean", "Gafa", "Longvie", "Patrick", "Escorial", "Orbis", "Rowenta", "Braun", "Remington", "Gama",
  "General Electric",
  // Herramientas
  "Black+Decker", "Dewalt", "Makita", "Bosch", "Stanley", "Gamma", "Dowen Pagio", "Lusqtoff",
  "Einhell", "Skil", "Bauker", "Truper", "Niwa", "Barovo", "Ingco", "Karcher", "Kassel", "Airbender",
  "Waggs", "Etheos", "TRV",
  // Drones, monopatines, consolas, handies, muebles
  "DJI", "Xiaomi", "Segway", "Ninebot", "Daihatsu", "Sony", "Baofeng", "Kenwood", "Motorola",
  "Yaesu", "Icom", "Retevis", "Cougar", "Corsair", "Redragon", "Logitech", "Delos", "Xtrike Me",
  "Netmak", "Level Up", "Meta", "Nintendo", "Everlast", "ELF", "Boya", "Amazon", "X-Shot",
  // Celulares, computación y audio
  "Apple", "Huawei", "Honor", "Realme", "Oppo", "Nokia", "Alcatel", "Tecno", "Infinix", "ZTE", "Google",
  "Asus", "Lenovo", "HP", "Dell", "Acer", "MSI", "Gigabyte", "Intel", "AMD", "Kingston", "Sandisk",
  "Western Digital", "Seagate", "Crucial", "Adata", "TP-Link", "Mercusys", "Tenda", "Ubiquiti",
  "Microsoft", "Razer", "HyperX", "SteelSeries", "Genius", "Noga", "Trust", "Epson", "Brother",
  "JBL", "Bose", "Sennheiser", "Audio-Technica", "Panasonic", "Pioneer", "Aiwa", "Marshall", "Edifier",
  "Amazfit", "Garmin", "Haylou", "Anker", "Baseus", "Ugreen", "Belkin", "Spigen",
  // Foto y video
  "Canon", "Nikon", "Fujifilm", "Olympus", "GoPro", "Insta360", "Godox", "Ulanzi", "Rode", "Zhiyun",
  "Sigma", "Tamron", "Manfrotto", "Hikvision", "Dahua", "Imou", "Ezviz",
];

/** Variantes del nombre que también cuentan como la marca. */
export const ALIAS: Record<string, string> = {
  "black & decker": "Black+Decker",
  "black and decker": "Black+Decker",
  "black decker": "Black+Decker",
  "de walt": "Dewalt",
  dahiatsu: "Daihatsu",
  xtrike: "Xtrike Me",
  playstation: "Sony",
  dualsense: "Sony",
  dualshock: "Sony",
  iphone: "Apple",
  ipad: "Apple",
  macbook: "Apple",
  airpods: "Apple",
  xbox: "Microsoft",
  "tp link": "TP-Link",
  tplink: "TP-Link",
  "western digital": "Western Digital",
  wd: "Western Digital",
  "go pro": "GoPro",
  "insta 360": "Insta360",
  redmi: "Xiaomi",
  poco: "Xiaomi",
  galaxy: "Samsung",
};

/** Marcas de relleno: no son una marca de verdad. */
const PLACEHOLDERS = new Set(["general", "generica", "generico", "sin marca", "otros", "otra", "varios", "otras marcas"]);

export function normalizarMarca(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+&ñ]+/g, " ")
    .trim();
}

export function esMarcaDeRelleno(brand: string | null | undefined): boolean {
  return !brand || !brand.trim() || PLACEHOLDERS.has(normalizarMarca(brand));
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

type Patron = { re: RegExp; marca: string; largo: number };

/**
 * Arma el buscador de marcas. `catalogo` son las marcas que ya usa la tienda
 * (para no inventar otra forma de escribirlas: "Tp-Link" si así está).
 */
export function crearDetectorDeMarca(catalogo: string[] = []): (nombre: string) => string | null {
  const forma = new Map<string, string>();
  // Primero las del catálogo, que ganan la forma escrita; las cortas (menos
  // de 3 letras) solo si están en la lista curada, porque dan falsos positivos.
  for (const m of catalogo) {
    const n = normalizarMarca(m);
    if (n.length >= 3 && !esMarcaDeRelleno(m) && !forma.has(n)) forma.set(n, m.trim());
  }
  for (const m of MARCAS) {
    const n = normalizarMarca(m);
    if (!forma.has(n)) forma.set(n, m);
  }
  const patrones: Patron[] = [];
  const agregar = (texto: string, marca: string) =>
    patrones.push({ re: new RegExp(`(^| )${escapar(texto)}( |$)`), marca, largo: texto.length });
  for (const [n, m] of forma) agregar(n, m);
  for (const [alias, marca] of Object.entries(ALIAS)) agregar(normalizarMarca(alias), forma.get(normalizarMarca(marca)) ?? marca);

  return (nombre: string) => {
    const n = normalizarMarca(nombre);
    let mejor: { pos: number; largo: number; marca: string } | null = null;
    for (const { re, marca, largo } of patrones) {
      const m = re.exec(n);
      if (!m) continue;
      const pos = m.index + m[1].length;
      // La que aparece primero; si empiezan igual, la más larga ("General Electric" antes que "General").
      if (!mejor || pos < mejor.pos || (pos === mejor.pos && largo > mejor.largo)) mejor = { pos, largo, marca };
    }
    return mejor?.marca ?? null;
  };
}

/** Atajo con la lista curada sola. */
export const marcaDesdeNombre = crearDetectorDeMarca();
