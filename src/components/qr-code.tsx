"use client";

import QRCode from "qrcode";
import { useMemo } from "react";

/**
 * QR dibujado como SVG, sin imágenes ni servicios de afuera: el contenido no
 * sale del navegador. Lo usa el pago con USDT para que el cliente escanee la
 * wallet desde el celular.
 */
export function QrCode({ value, size = 184, label }: { value: string; size?: number; label: string }) {
  const { path, count } = useMemo(() => {
    const { modules } = QRCode.create(value, { errorCorrectionLevel: "M" });
    let d = "";
    for (let y = 0; y < modules.size; y += 1) {
      for (let x = 0; x < modules.size; x += 1) {
        if (modules.get(y, x)) d += `M${x + 4} ${y + 4}h1v1h-1z`;
      }
    }
    return { path: d, count: modules.size + 8 };
  }, [value]);

  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${count} ${count}`}
      shapeRendering="crispEdges"
      className="rounded-xl border border-ink-100 bg-white"
    >
      <rect width={count} height={count} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
