import type { QrSvg } from "@/lib/qr-svg";

/**
 * QR dibujado como SVG, sin imágenes ni servicios de afuera: el contenido no
 * sale de la tienda. El dibujo llega armado del servidor (`qrSvg`). Lo usa el
 * pago con USDT para que el cliente escanee la wallet desde el celular.
 */
export function QrCode({ qr, size = 184, label }: { qr: QrSvg; size?: number; label: string }) {
  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${qr.size} ${qr.size}`}
      shapeRendering="crispEdges"
      className="rounded-xl border border-ink-100 bg-white"
    >
      <rect width={qr.size} height={qr.size} fill="#fff" />
      <path d={qr.path} fill="#000" />
    </svg>
  );
}
