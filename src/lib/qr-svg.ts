import QRCode from "qrcode";

export type QrSvg = { path: string; size: number };

/**
 * El QR como un `path` de SVG, armado en el servidor: el navegador recibe solo
 * el dibujo y no la librería de QR (unos 15 KB gzip que se bajaban en todas
 * las páginas de pedido aunque solo USDT muestra un QR). `size` incluye el
 * margen blanco de 4 módulos que piden los lectores.
 */
export function qrSvg(value: string): QrSvg {
  const { modules } = QRCode.create(value, { errorCorrectionLevel: "M" });
  let path = "";
  for (let y = 0; y < modules.size; y += 1) {
    for (let x = 0; x < modules.size; x += 1) {
      if (modules.get(y, x)) path += `M${x + 4} ${y + 4}h1v1h-1z`;
    }
  }
  return { path, size: modules.size + 8 };
}
