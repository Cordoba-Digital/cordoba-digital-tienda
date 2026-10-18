/**
 * Medición de fotos para el filtro "Fotos chicas" del panel: el tamaño sale de
 * la cabecera del archivo, con solo los primeros KB.
 *
 * Uso: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import sharp from "sharp";

import { imageSizeFromHeader, isSmallPhoto, SMALL_PHOTO_PX } from "../../src/lib/image-dimensions";

function lienzo(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: "#f15a24" } });
}

test("lee ancho y alto de JPG, PNG, GIF y los tres tipos de WebP", async () => {
  const casos: [string, Buffer][] = [
    ["jpg", await lienzo(1200, 900).withMetadata({ exif: { IFD0: { Copyright: "Córdoba Digital" } } }).jpeg().toBuffer()],
    ["jpg progresivo", await lienzo(640, 480).jpeg({ progressive: true }).toBuffer()],
    ["png", await lienzo(1600, 1200).png().toBuffer()],
    ["gif", await lienzo(300, 200).gif().toBuffer()],
    ["webp con pérdida", await lienzo(1024, 768).webp({ quality: 80 }).toBuffer()],
    ["webp sin pérdida", await lienzo(500, 333).webp({ lossless: true }).toBuffer()],
    ["webp con transparencia", await sharp({ create: { width: 700, height: 701, channels: 4, background: "#0000" } }).webp().toBuffer()],
  ];
  for (const [nombre, archivo] of casos) {
    const meta = await sharp(archivo).metadata();
    assert.deepEqual(imageSizeFromHeader(archivo), { width: meta.width, height: meta.height }, nombre);
  }
});

test("alcanza con el principio del archivo", async () => {
  const archivo = await lienzo(1600, 1600).webp({ quality: 82 }).toBuffer();
  assert.deepEqual(imageSizeFromHeader(archivo.subarray(0, 64)), { width: 1600, height: 1600 });
});

test("devuelve null si no reconoce la cabecera", () => {
  assert.equal(imageSizeFromHeader(new Uint8Array(0)), null);
  assert.equal(imageSizeFromHeader(Buffer.from("<html>no es una foto</html>")), null);
  assert.equal(imageSizeFromHeader(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])), null);
});

test("chica es la que tiene el lado más largo por debajo del límite", () => {
  assert.equal(isSmallPhoto({ width: SMALL_PHOTO_PX - 1, height: 300 }), true);
  assert.equal(isSmallPhoto({ width: 600, height: SMALL_PHOTO_PX }), false);
  assert.equal(isSmallPhoto({ width: 1600, height: 1200 }), false);
  assert.equal(isSmallPhoto({ width: null, height: null }), false);
});
