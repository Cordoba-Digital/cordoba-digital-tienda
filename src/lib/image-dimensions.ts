/**
 * Ancho y alto de una foto leyendo solo su cabecera, sin decodificarla.
 *
 * Alcanza con los primeros KB del archivo: así el panel puede medir las ~2.600
 * fotos del catálogo pidiendo un pedazo de cada una en vez de bajarlas enteras.
 * Lee JPG, PNG, WebP y GIF; para AVIF (o una cabecera rara) devuelve null y
 * quien llama prueba con sharp sobre el archivo completo.
 */

export type ImageSize = { width: number; height: number };

/** Lado más largo por debajo del cual la foto se ve borrosa en la ficha (que la muestra a ~700 px). */
export const SMALL_PHOTO_PX = 800;

export function isSmallPhoto(size: { width: number | null; height: number | null }): boolean {
  if (!size.width || !size.height) return false;
  return Math.max(size.width, size.height) < SMALL_PHOTO_PX;
}

export function imageSizeFromHeader(bytes: Uint8Array): ImageSize | null {
  const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (buf.length < 24) return null;

  // PNG: la cabecera IHDR va siempre primero.
  if (buf.readUInt32BE(0) === 0x89504e47 && buf.toString("ascii", 12, 16) === "IHDR") {
    return valid(buf.readUInt32BE(16), buf.readUInt32BE(20));
  }

  // GIF
  if (buf.toString("ascii", 0, 4) === "GIF8") {
    return valid(buf.readUInt16LE(6), buf.readUInt16LE(8));
  }

  // WebP: con pérdida (VP8), sin pérdida (VP8L) o extendido (VP8X).
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP" && buf.length >= 30) {
    const chunk = buf.toString("ascii", 12, 16);
    if (chunk === "VP8 ") {
      if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return null;
      return valid(buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff);
    }
    if (chunk === "VP8L") {
      if (buf[20] !== 0x2f) return null;
      const bits = buf.readUInt32LE(21);
      return valid((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1);
    }
    if (chunk === "VP8X") {
      return valid(buf.readUIntLE(24, 3) + 1, buf.readUIntLE(27, 3) + 1);
    }
    return null;
  }

  // JPG: el tamaño está en el primer marcador SOF; se saltean los anteriores (EXIF, etc.).
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buf.length) {
      if (buf[offset] !== 0xff) return null;
      const marker = buf[offset + 1];
      if (marker === 0xff) {
        offset += 1;
        continue;
      }
      const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) return valid(buf.readUInt16BE(offset + 7), buf.readUInt16BE(offset + 5));
      offset += 2 + buf.readUInt16BE(offset + 2);
    }
    return null;
  }

  return null;
}

function valid(width: number, height: number): ImageSize | null {
  return width > 0 && height > 0 ? { width, height } : null;
}
