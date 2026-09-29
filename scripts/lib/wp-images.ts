/**
 * Elección de variantes de imagen del catálogo de WooCommerce.
 *
 * Vive aparte de `migrate-wp.ts` para que el backfill
 * (`scripts/backfill-image-srcsets.ts`) use exactamente la misma lógica y no
 * diverja: si las dos copiaran el código, una corrección en una y no en la
 * otra volvería a mezclar fotos sin que nadie se dé cuenta.
 *
 * Contexto: el optimizador de imágenes de Vercel está bloqueado en este
 * proyecto (`unoptimized: true`), así que se sirven los archivos de WP. WP
 * publica un `srcset` con anchos (100w, 300w, 441w, 800w, 1024w…) y el original
 * puede pesar 1,3 MB, de ahí que se guarde la variante correcta.
 */

export type WPImage = { src: string; thumbnail?: string; alt?: string; srcset?: string };

/**
 * Ancho objetivo de la foto principal de la ficha (~480 px de marco): 800w.
 * El resto de la galería son miniaturas: 441w alcanza.
 */
const TARGET_W_MAIN = 800;
const TARGET_W_REST = 441;

/** Quita el sufijo de tamaño que WooCommerce agrega (`foto-800x800.jpg`). */
function baseOf(url: string): string {
  return url.replace(/-\d+x\d+(?=\.[a-z0-9]+$)/i, "");
}

function samePhoto(a: string, b: string): boolean {
  return baseOf(a) === baseOf(b);
}

/** Ancho declarado en el nombre del archivo; si no lo tiene, 441w (miniatura). */
function widthOf(url: string): number {
  const m = /-(\d+)x\d+(?=\.[a-z0-9]+$)/i.exec(url);
  return m ? Number.parseInt(m[1], 10) : 441;
}

/**
 * Elige la variante liviana de la imagen en vez del original.
 *
 * Si el original ya es más chico que el objetivo en píxeles, se deja el
 * original (no hay una variante más chica que sirva).
 */
export function pickImageVariant(image: WPImage, isMain: boolean): string {
  const src = image.src;
  const srcset = image.srcset?.trim();
  if (!srcset) return src;

  const target = isMain ? TARGET_W_MAIN : TARGET_W_REST;
  const variants = srcset
    .split(",")
    .map((part) => {
      const [url, width] = part.trim().split(/\s+/);
      return { url, w: Number.parseInt(width ?? "", 10) };
    })
    .filter((v) => v.url && Number.isFinite(v.w))
    .sort((a, b) => a.w - b.w);

  if (!variants.length) return src;

  // La más grande que no pase del objetivo; si ninguna entra, la mayor disponible.
  const fit = [...variants].reverse().find((v) => v.w <= target);
  if (fit) return fit.url;
  const original = variants.find((v) => v.url === src);
  return original?.url ?? variants[variants.length - 1].url;
}

/**
 * Variantes de UNA sola foto, en formato `url 300w`.
 *
 * Siempre incluye `url` (la variante elegida por `pickImageVariant`) aunque WP
 * no la liste: sin eso el `src` sería la única pista y el navegador podría
 * descargar el original de 1,3 MB.
 *
 * Filtra las entradas que pertenecen a otra foto: WP a veces mete en el
 * `srcset` de un thumbnail las variantes del archivo grande de otra imagen, y
 * sin ese filtro el navegador puede terminar mostrando esa otra foto.
 */
export function parseSrcset(srcset: string | undefined, url: string): string[] {
  const entries = (srcset ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => /\s\d+w$/.test(part));

  const variants = entries.filter((entry) => {
    const [entryUrl] = entry.split(/\s+/);
    return entryUrl === url || samePhoto(entryUrl, url);
  });

  return [...new Set([`${url} ${widthOf(url)}w`, ...variants])];
}

/**
 * Galería completa de un producto: una URL y un srcset por foto, alineados por
 * índice (`srcSets[i]` solo contiene variantes de `urls[i]`).
 *
 * Esto es lo que arregla el bug de miniaturas repetidas: con un único srcset
 * plano para todo el producto, la galería se lo pasaba a cada miniatura y el
 * navegador elegía por ancho una variante que podía ser de otra foto.
 */
export function buildGallery(pImages: WPImage[] | undefined): {
  urls: string[];
  srcSets: string[][];
} {
  const gallery: { url: string; srcSet: string[] }[] = [];
  const seen = new Set<string>();

  (pImages ?? []).forEach((image, index) => {
    const url = pickImageVariant(image, index === 0);
    if (!url?.trim() || seen.has(url)) return;
    seen.add(url);
    gallery.push({ url, srcSet: parseSrcset(image.srcset, url) });
  });

  return { urls: gallery.map((g) => g.url), srcSets: gallery.map((g) => g.srcSet) };
}
