/**
 * Ventana de páginas para la paginación.
 *
 * Con 2.588 productos el catálogo tiene 108 páginas. Renderizar un botón por
 * página empujaba la fila a ~2.000 px y hacía desbordar la página en
 * horizontal: en `/productos` el `docScrollW` llegaba a 3.633 px con un viewport
 * de 1.707.
 *
 * Devuelve 5 páginas alrededor de la actual (siempre la primera y la última
 * visibles) y el string `"gap"` donde hay que poner "…".
 */
export function pageWindow(current: number, total: number, radius = 2): (number | "gap")[] {
  if (total <= 1) return total === 1 ? [1] : [];

  // 1 … actual-1 actual actual+1 … total
  const pages = new Set<number>([1, total, current]);
  for (let d = 1; d <= radius; d++) {
    if (current - d >= 1) pages.add(current - d);
    if (current + d <= total) pages.add(current + d);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  let prev = 0;
  for (const page of sorted) {
    if (prev && page - prev > 1) out.push("gap");
    out.push(page);
    prev = page;
  }
  return out;
}
