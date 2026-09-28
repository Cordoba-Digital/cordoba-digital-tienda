/**
 * Imagen de producto con `srcset`.
 *
 * El optimizador de imágenes de Vercel está bloqueado en este proyecto
 * (`unoptimized: true` en `next.config.ts`), así que `<Image>` sirve el archivo
 * original. Como WooCommerce publica variantes de 100w a 1536w, usamos
 * `srcset` a mano: el navegador descarga la que corresponde al ancho real de
 * pantalla (≈441w en las tarjetas, ≈800w en la ficha) en vez de los 1,3 MB del
 * original.
 */

type Props = {
  /** URL principal (generalmente la variante de 800w). */
  src: string;
  /** Variantes adicionales, en formato `url 300w`. */
  srcSet?: string[];
  alt: string;
  sizes: string;
  className?: string;
  /** Para que el navegador no descargue la imagen si está fuera de pantalla. */
  priority?: boolean;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
};

export function ProductImg({
  src,
  srcSet = [],
  alt,
  sizes,
  className,
  priority = false,
  width,
  height,
  style,
}: Props) {
  /* eslint-disable @next/next/no-img-element -- `next/image` no sirve: con el
     optimizador bloqueado en Vercel habría que subir 1,3 MB por foto, y no
     soporta el `srcset` que publica WooCommerce. */
  return (
    <img
      src={src}
      srcSet={srcSet.length ? srcSet.join(", ") : undefined}
      sizes={srcSet.length ? sizes : undefined}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={className}
      style={style}
    />
  );
}
