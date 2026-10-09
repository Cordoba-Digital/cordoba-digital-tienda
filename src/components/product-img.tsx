"use client";

import { useMemo, useState } from "react";

import { resolveMedia, resolveSrcSet } from "@/lib/media";

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
  }

  if (failed || !current) {
    return <ProductPlaceholder />;
  }

  // `srcSet` con mayúscula, que es la prop que React conoce, y no `srcset` a
  // mano con un cast: con la minúscula React avisaba "Invalid DOM property
  // `srcset`" en cada imagen y salía el cartel de "1 Issue" en desarrollo.
  const listaSrcSet = resolvedSet.length && current === resolved ? resolvedSet.join(", ") : undefined;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={current}
      srcSet={listaSrcSet}
      sizes={resolvedSet.length ? sizes : undefined}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      className={className}
      style={style}
      onError={() => {
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
