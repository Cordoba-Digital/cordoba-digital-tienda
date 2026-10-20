/**
 * El QR del pago con USDT se arma en el servidor.
 *
 * Uso: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import QRCode from "qrcode";

import { qrSvg } from "../../src/lib/qr-svg";

const WALLET = "TQrZ8tKfjL7Yxv3g2gZ4sV9Q7aH1pLmN5x";

test("el QR trae el margen de 4 módulos y un cuadrito por módulo negro", () => {
  const { modules } = QRCode.create(WALLET, { errorCorrectionLevel: "M" });
  const qr = qrSvg(WALLET);
  assert.equal(qr.size, modules.size + 8);
  let negros = 0;
  for (let i = 0; i < modules.size * modules.size; i += 1) if (modules.data[i]) negros += 1;
  assert.equal(qr.path.match(/M/g)?.length, negros);
  // La esquina de arriba a la izquierda (patrón de posición) arranca después del margen.
  assert.ok(qr.path.startsWith("M4 4h1v1h-1z"));
});

test("la misma wallet da siempre el mismo dibujo", () => {
  assert.equal(qrSvg(WALLET).path, qrSvg(WALLET).path);
  assert.notEqual(qrSvg(WALLET).path, qrSvg(`${WALLET}x`).path);
});
