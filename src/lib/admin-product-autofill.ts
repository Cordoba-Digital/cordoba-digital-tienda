/**
 * Autocompletado del alta de productos: lo que se puede deducir del nombre
 * (marca, modelo, memoria, RAM, estado) y una sugerencia de textos para
 * Google. Puro, sin base de datos: lo usa el formulario mientras se escribe.
 *
 * El nombre sigue la convención de las fichas (data/fichas/GUIA.md):
 * "Marca Modelo Variante 256 GB 8 GB RAM".
 */

/** Líneas de producto que delatan la marca aunque no esté escrita. */
const BRAND_HINTS: Record<string, string> = {
  iphone: "Apple",
  ipad: "Apple",
  macbook: "Apple",
  imac: "Apple",
  airpods: "Apple",
  "apple watch": "Apple",
  galaxy: "Samsung",
  redmi: "Xiaomi",
  poco: "Xiaomi",
  moto: "Motorola",
  thinkpad: "Lenovo",
  ideapad: "Lenovo",
  thinkbook: "Lenovo",
  legion: "Lenovo",
  pavilion: "HP",
  victus: "HP",
  omen: "HP",
  vivobook: "Asus",
  zenbook: "Asus",
  rog: "Asus",
  tuf: "Asus",
  aspire: "Acer",
  nitro: "Acer",
  predator: "Acer",
  inspiron: "Dell",
  latitude: "Dell",
  vostro: "Dell",
  alienware: "Dell",
  playstation: "Sony",
  xbox: "Microsoft",
  surface: "Microsoft",
  pixel: "Google",
};

/** Grafías propias que no salen de poner mayúscula inicial. */
const SPELLINGS: Record<string, string> = {
  iphone: "iPhone",
  ipad: "iPad",
  imac: "iMac",
  macbook: "MacBook",
  airpods: "AirPods",
  playstation: "PlayStation",
  thinkpad: "ThinkPad",
  ideapad: "IdeaPad",
  vivobook: "VivoBook",
  zenbook: "ZenBook",
};
const LOWER_WORDS = new Set(["de", "del", "con", "sin", "y", "para", "en"]);

/**
 * Mayúsculas en las palabras escritas todo en minúscula: "galaxy" → "Galaxy",
 * "a55" → "A55", "5g" → "5G", "iphone" → "iPhone". Lo que ya tiene alguna
 * mayúscula se respeta tal cual.
 */
function capitalizeWords(text: string): string {
  return text.replace(/[a-záéíóúñü0-9+]+/gi, (word) => {
    if (word !== word.toLowerCase() || LOWER_WORDS.has(word)) return word;
    if (SPELLINGS[word]) return SPELLINGS[word];
    if (/\d/.test(word)) return word.toUpperCase();
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
}

export type NameGuess = {
  brand: string;
  model: string;
  /** "256 GB", "1 TB". */
  storage: string;
  /** "8 GB" (sin la palabra RAM, que la ficha agrega sola). */
  ram: string;
  condition: "Nuevo" | "Usado" | "";
  /** El nombre con las memorias y la marca escritas como pide la guía; "" si ya estaba bien. */
  cleanName: string;
};

const MEMORY_RE = /(\d+(?:[.,]\d+)?)\s*(gb|tb)\b(\s*(?:de\s+)?ram\b)?/gi;
const USED_RE = /\b(usad[oa]|reacondicionad[oa]|seminuev[oa]|refurbished|outlet)\b/i;

function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findBrand(name: string, knownBrands: string[]): string {
  const lower = ` ${name.toLowerCase()} `;
  // Primero las marcas del catálogo, las más largas antes ("Tp-Link" antes que "Link").
  const sorted = [...knownBrands].filter((b) => b.trim().length > 1).sort((a, b) => b.length - a.length);
  for (const brand of sorted) {
    if (new RegExp(`(^|[^a-z0-9])${escapeRe(brand.toLowerCase())}([^a-z0-9]|$)`).test(lower)) return brand;
  }
  for (const [hint, brand] of Object.entries(BRAND_HINTS)) {
    if (new RegExp(`(^|[^a-z0-9])${escapeRe(hint)}([^a-z0-9]|$)`).test(lower)) {
      // Si el catálogo ya usa esa marca con otra grafía ("APPLE"), se respeta la del catálogo.
      return knownBrands.find((b) => b.toLowerCase() === brand.toLowerCase()) ?? brand;
    }
  }
  return "";
}

export function guessFromName(rawName: string, knownBrands: string[] = []): NameGuess {
  const name = rawName.replace(/\s+/g, " ").trim();
  const empty: NameGuess = { brand: "", model: "", storage: "", ram: "", condition: "", cleanName: "" };
  if (name.length < 3) return empty;

  const brand = findBrand(name, knownBrands);

  // Memorias: la que dice "RAM" es la RAM; si hay dos sin aclarar, la más chica es la RAM.
  const memories = [...name.matchAll(MEMORY_RE)].map((m) => {
    const amount = Number(m[1].replace(",", "."));
    const unit = m[2].toUpperCase();
    return { index: m.index ?? 0, text: m[0], amount, unit, gb: unit === "TB" ? amount * 1024 : amount, isRam: Boolean(m[3]) };
  });
  let ramMem = memories.find((m) => m.isRam);
  let storageMem = memories.find((m) => !m.isRam && m !== ramMem);
  if (!ramMem && memories.length >= 2) {
    const [a, b] = memories;
    const small = a.gb <= b.gb ? a : b;
    // Solo cuando la chica tiene tamaño de RAM (hasta 64 GB) y la grande de almacenamiento.
    if (small.gb <= 64 && Math.max(a.gb, b.gb) >= 64) {
      ramMem = small;
      storageMem = small === a ? b : a;
    }
  }
  const fmt = (m: { amount: number; unit: string }) => `${String(m.amount).replace(".", ",")} ${m.unit}`;
  const storage = storageMem ? fmt(storageMem) : "";
  const ram = ramMem ? fmt(ramMem) : "";

  // Modelo: lo que va entre la marca y la primera memoria ("Galaxy A56 5G").
  let model = name;
  if (memories.length) model = model.slice(0, Math.min(...memories.map((m) => m.index)));
  if (brand) model = model.replace(new RegExp(`(^|\\s)${escapeRe(brand)}(?=\\s|$)`, "i"), " ");
  model = capitalizeWords(model.replace(USED_RE, " ").replace(/\s+/g, " ").trim());
  if (model.split(" ").length > 6) model = "";

  const condition = USED_RE.test(name) ? "Usado" : "";

  // Nombre prolijo: "256gb" → "256 GB", "8gb" (si es la RAM) → "8 GB RAM", marca con mayúscula.
  let clean = name;
  for (const m of [...memories].sort((x, y) => y.index - x.index)) {
    const replacement = m === ramMem ? `${fmt(m)} RAM` : fmt(m);
    clean = clean.slice(0, m.index) + replacement + clean.slice(m.index + m.text.length);
  }
  if (brand) clean = clean.replace(new RegExp(`(^|\\s)${escapeRe(brand)}(?=\\s|$)`, "i"), `$1${brand}`);
  clean = capitalizeWords(clean.replace(/\s+/g, " ").trim());

  return { brand, model, storage, ram, condition, cleanName: clean !== name ? clean : "" };
}

/** Textos para Google según la guía de fichas: título de hasta 45 y descripción de 120 a 160 caracteres. */
export function suggestSeo(input: { name: string; shortDescription: string; condition: string }): { title: string; description: string } {
  const name = input.name.trim();
  const title = name.length <= 45 ? name : `${name.slice(0, 44).replace(/\s+\S*$/, "")}`;
  const closing = `${input.condition === "Usado" ? "Usado" : "Nuevo"}, con garantía y envíos a todo el país.`;
  let lead = input.shortDescription.trim() || name;
  const max = 160 - closing.length - 1;
  if (lead.length > max) lead = `${lead.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
  if (!/[.!?…]$/.test(lead)) lead += ".";
  return { title, description: `${lead} ${closing}` };
}

/** Palabras del modelo para buscar productos parecidos ya cargados ("samsung", "galaxy", "a56"). */
export function similarityTerms(name: string, knownBrands: string[] = []): string[] {
  const guess = guessFromName(name, knownBrands);
  const base = [guess.brand, guess.model].filter(Boolean).join(" ") || name.replace(MEMORY_RE, " ");
  return base
    .toLowerCase()
    .split(/[^a-z0-9áéíóúñü+]+/i)
    .filter((t) => t.length >= 2 && !["de", "con", "sin", "y", "para", "the"].includes(t))
    .slice(0, 4);
}
