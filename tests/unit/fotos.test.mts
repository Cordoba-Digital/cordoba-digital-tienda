/**
 * Fotos del catálogo: las propias pasan por el optimizador de Vercel (variantes
 * chicas para cards y miniaturas) y las del WordPress viejo van directo.
 *
 * Uso: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { canOptimize } from "../../src/lib/media";

test("optimiza las fotos de Blob, R2 y las propias de la tienda", () => {
  assert.ok(canOptimize("https://abc123.public.blob.vercel-storage.com/productos/celu-1.webp"));
  assert.ok(canOptimize("https://pub-123.r2.dev/productos/celu-1.webp"));
  assert.ok(canOptimize("/images/products/g29.png"));
  assert.ok(canOptimize("/imagenes/celu-0123456789abcdef01234567.webp"));
});

test("no manda al optimizador lo que no puede bajar", () => {
  assert.equal(canOptimize("https://www.cordobadigital.net/wp-content/uploads/2025/01/celu.jpg"), false);
  assert.equal(canOptimize("http://abc.public.blob.vercel-storage.com/x.webp"), false);
  assert.equal(canOptimize("https://evil.com/?x=public.blob.vercel-storage.com"), false);
  assert.equal(canOptimize("//evil.com/x.png"), false);
  assert.equal(canOptimize("/_next/image?url=x"), false);
  assert.equal(canOptimize("data:image/png;base64,AAAA"), false);
  assert.equal(canOptimize(""), false);
});
