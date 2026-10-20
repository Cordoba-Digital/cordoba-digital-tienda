"use client";

import { getImageProps } from "next/image";
import { useMemo, useState } from "react";

import { canOptimize, resolveMedia, resolveSrcSet } from "@/lib/media";

/**
 * Las fotos guardadas miden hasta 1600 px: sin achicarlas, una card de 250 px
 * o una miniatura de 72 px bajaban la foto entera. El optimizador de Vercel
 * arma las variantes (y las sirve en AVIF/WebP) según el `sizes` de cada uso.
 */
function optimizedSrcSet(src: string, sizes: string, alt: string): string | undefined {
  if (!canOptimize(src)) return undefined;
  try {
    return getImageProps({ src, alt, sizes, fill: true, quality: 75 }).props.srcSet;
  } catch {
    return undefined;
  }
}

type Props = {
  src: string;
  srcSet?: string[];
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
};

export function ProductPlaceholder({ className = "" }: { className?: string }) {
  return (
    <div
      className={`grid h-full w-full place-items-center bg-gradient-to-br from-white to-ink-100 ${className}`}
      aria-hidden
    >
      <svg viewBox="0 0 64 64" className="h-12 w-12 text-ink-300" fill="none">
        <rect x="8" y="14" width="48" height="36" rx="6" stroke="currentColor" strokeWidth="2" />
        <circle cx="22" cy="28" r="4" stroke="currentColor" strokeWidth="2" />
        <path d="M14 44l12-12 8 8 6-6 10 10" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

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
  const resolved = useMemo(() => resolveMedia(src), [src]);
  const resolvedSet = useMemo(() => resolveSrcSet(srcSet), [srcSet]);
  const fallback = useMemo(() => {
    if (!src || src === resolved) return "";
    return src;
  }, [src, resolved]);

  const [current, setCurrent] = useState(resolved || fallback);
  const [failed, setFailed] = useState(!src);
  const [triedFallback, setTriedFallback] = useState(false);
  // Si el optimizador no puede con una foto (un host que lo bloquea), se
  // vuelve a pedir el archivo original antes de mostrar el placeholder.
  const [optimizerFailed, setOptimizerFailed] = useState(false);

  // Cuando React reutiliza el componente para otra foto (las galerías y las
  // cards con segunda imagen al hover), hay que volver al estado inicial. Se
  // ajusta durante el render y no en un efecto: llamar setState dentro de un
  // efecto dispara un segundo render en cascada y eslint lo marca como error.
  const [srcAnterior, setSrcAnterior] = useState(src);
  if (srcAnterior !== src) {
    setSrcAnterior(src);
    setCurrent(resolved || fallback);
    setFailed(!src);
    setTriedFallback(false);
    setOptimizerFailed(false);
  }

  if (failed || !current) {
    return <ProductPlaceholder />;
  }

  // `srcSet` con mayúscula, que es la prop que React conoce, y no `srcset` a
  // mano con un cast: con la minúscula React avisaba "Invalid DOM property
  // `srcset`" en cada imagen y salía el cartel de "1 Issue" en desarrollo.
  const listaSrcSet =
    resolvedSet.length && current === resolved
      ? resolvedSet.join(", ")
      : optimizerFailed
        ? undefined
        : optimizedSrcSet(current, sizes, alt);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={current}
      srcSet={listaSrcSet}
      sizes={listaSrcSet ? sizes : undefined}
      alt={alt}
      width={width}
      height={height}
      // La foto principal (LCP) se pide con prioridad alta y se pinta apenas
      // llega; `next/image` haría lo mismo, pero acá el <img> se arma a mano.
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding={priority ? undefined : "async"}
      referrerPolicy="no-referrer"
      className={className}
      style={style}
      onError={() => {
        if (listaSrcSet && !resolvedSet.length && !optimizerFailed) {
          setOptimizerFailed(true);
          return;
        }
        if (!triedFallback && fallback && fallback !== current) {
          setTriedFallback(true);
          setCurrent(fallback);
          return;
        }
        setFailed(true);
      }}
    />
  );
}
