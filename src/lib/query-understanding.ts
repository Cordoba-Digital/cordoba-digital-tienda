/**
 * Entender la búsqueda antes de buscar, como el `domain_discovery` de Mercado
 * Libre: "celular samsung" no se busca como un texto entero (no aparece así en
 * ningún nombre) sino como la categoría Celulares + la marca Samsung, y lo que
 * sobra ("a54", "128gb") se busca palabra por palabra.
 *
 * Todo es en memoria y sin base: recibe las categorías y las marcas que ya
 * tiene el catálogo y devuelve qué detectó. La consulta la arma `queries.ts`.
 */

export type QueryCategory = { id: number; name: string; path: string; depth: number; parentId: number | null; count: number };

export type QueryUnderstanding = {
  /** Categoría detectada (la más específica), o null. */
  category: { id: number; name: string; path: string } | null;
  /** Marca tal como está guardada en los productos, o null. */
  brand: string | null;
  /** Palabras que quedan para buscar en nombre, marca, descripción y etiquetas. */
  terms: string[];
};

/** Palabras que no ayudan a buscar ni a reconocer categorías. */
const STOPWORDS = new Set([
  "de", "del", "la", "las", "el", "los", "y", "e", "o", "u", "para", "p", "con", "sin", "en", "a", "un", "una", "por",
  // Las categorías de WooCommerce llevan la ciudad en el nombre ("Notebooks Córdoba").
  "cordoba",
]);

/** Minúsculas, sin tildes y sin signos: "Cámaras P/ Autos" → "camaras p autos". */
export function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

/** Singular aproximado para comparar: "celulares" y "celular" son lo mismo. */
export function stem(word: string): string {
  if (word.length > 4 && word.endsWith("es")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s")) return word.slice(0, -1);
  return word;
}

function words(text: string): string[] {
  return normalizeSearch(text).split(" ").filter(Boolean);
}

function significant(text: string): string[] {
  return words(text).filter((w) => !STOPWORDS.has(w)).map(stem);
}

/** Busca `needle` como secuencia seguida dentro de `haystack`; devuelve la posición o -1. */
function indexOfSequence(haystack: string[], needle: string[]): number {
  if (!needle.length) return -1;
  for (let i = 0; i + needle.length <= haystack.length; i++) {
    if (needle.every((w, j) => haystack[i + j] === w)) return i;
  }
  return -1;
}

export function understandQuery(
  query: string,
  catalog: { categories: QueryCategory[]; brands: string[] },
): QueryUnderstanding {
  const tokens = words(query);
  const used = new Set<number>();

  // Marca: la más larga que aparezca entera ("tp link" antes que "tp").
  let brand: string | null = null;
  const brands = catalog.brands
    .map((name) => ({ name, parts: words(name) }))
    .filter((b) => b.parts.length)
    .sort((a, b) => b.parts.length - a.parts.length);
  for (const candidate of brands) {
    const at = indexOfSequence(tokens, candidate.parts);
    if (at >= 0) {
      brand = candidate.name;
      candidate.parts.forEach((_, j) => used.add(at + j));
      break;
    }
  }

  // Categoría: todas sus palabras tienen que estar en la búsqueda (sin contar
  // la marca, salvo que la categoría sea la marca dentro de otra que también
  // se nombró, como Celulares › Samsung).
  const stems = tokens.map((t, i) => ({ i, s: stem(t) }));
  const free = stems.filter((t) => !used.has(t.i) && !STOPWORDS.has(tokens[t.i]));
  const brandStems = new Set(brand ? significant(brand) : []);
  const byId = new Map(catalog.categories.map((c) => [c.id, c]));

  type Match = { category: QueryCategory; consumed: number[]; size: number };
  const matches: Match[] = [];
  for (const category of catalog.categories) {
    const need = significant(category.name);
    if (!need.length) continue;
    const consumed: number[] = [];
    const ok = need.every((w) => {
      const hit = free.find((t) => t.s === w && !consumed.includes(t.i));
      if (hit) {
        consumed.push(hit.i);
        return true;
      }
      return brandStems.has(w);
    });
    if (ok) matches.push({ category, consumed, size: need.length });
  }

  const isAncestor = (maybe: QueryCategory, of: QueryCategory) => {
    for (let p = of.parentId; p != null; p = byId.get(p)?.parentId ?? null) if (p === maybe.id) return true;
    return false;
  };
  // Una categoría que solo matchea por la marca vale si un ancestro también se nombró.
  const valid = matches.filter((m) => m.consumed.length > 0 || matches.some((o) => o.consumed.length > 0 && isAncestor(o.category, m.category)));
  // Gana la más específica: la que descienda de otra que también matcheó, y
  // entre las que no tienen relación, la que más palabras usó.
  const specific = valid.filter((m) => !valid.some((o) => o !== m && isAncestor(m.category, o.category)));
  specific.sort((a, b) => b.size - a.size || b.category.count - a.category.count);
  let category: Match | null = null;
  if (specific.length === 1) category = specific[0];
  else if (specific.length > 1 && specific[0].size > specific[1].size) category = specific[0];
  // Empate entre categorías distintas ("samsung" en Celulares y en TV): no se elige ninguna.

  if (category) {
    // Las palabras de la categoría y de los ancestros que también se nombraron
    // ("celular" en "celular samsung") ya están cubiertas por el filtro.
    for (const m of valid) {
      if (m === category || isAncestor(m.category, category.category)) m.consumed.forEach((i) => used.add(i));
    }
  }

  const terms = tokens.filter((t, i) => !used.has(i) && !STOPWORDS.has(t));
  return {
    category: category ? { id: category.category.id, name: category.category.name, path: category.category.path } : null,
    brand,
    terms,
  };
}

/**
 * Categorías para sugerir mientras se escribe en el buscador del encabezado:
 * "celu" ya muestra Celulares. A diferencia de `understandQuery`, la última
 * palabra puede estar a medio escribir, así que cada palabra alcanza con que
 * sea el comienzo de una palabra del nombre. La marca nombrada no cuenta
 * ("celular samsung" sugiere Celulares) y las vacías no se sugieren.
 */
export function suggestCategories(
  query: string,
  catalog: { categories: QueryCategory[]; brands: string[] },
  limit = 3,
): QueryCategory[] {
  const brandWords = new Set(catalog.brands.flatMap((b) => words(b)));
  const tokens = words(query).filter((t) => !STOPWORDS.has(t) && !brandWords.has(t));
  if (!tokens.length) return [];

  const scored: { category: QueryCategory; first: boolean }[] = [];
  for (const category of catalog.categories) {
    if (category.count <= 0) continue;
    const name = words(category.name).filter((w) => !STOPWORDS.has(w));
    // Con el singular aproximado, "celulares" también encuentra "Celular".
    const hits = tokens.map((t) => name.findIndex((w) => w.startsWith(t) || w.startsWith(stem(t))));
    if (hits.some((i) => i < 0)) continue;
    scored.push({ category, first: hits.includes(0) });
  }
  scored.sort(
    (a, b) =>
      Number(b.first) - Number(a.first) || a.category.depth - b.category.depth || b.category.count - a.category.count,
  );
  return scored.slice(0, limit).map((s) => s.category);
}
