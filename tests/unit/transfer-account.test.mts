/**
 * Pruebas de los datos de transferencia que ve el cliente.
 *
 * Antes la página del pedido mostraba un CBU de ejemplo escrito en el código:
 * un cliente podía transferir a una cuenta que no existe. Ahora los datos salen
 * de variables y, si faltan, no se inventa nada.
 *
 * Uso: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { transferAccount } from "../../src/lib/transfer-account";

test("sin variables no hay cuenta", () => {
  assert.equal(transferAccount({}), null);
});

test("sin titular no hay cuenta", () => {
  assert.equal(transferAccount({ TRANSFER_CBU: "0000003100000000000001", TRANSFER_ALIAS: "algo.alias" }), null);
});

test("un número que no tiene 22 dígitos no se muestra", () => {
  assert.equal(transferAccount({ TRANSFER_CBU: "123", TRANSFER_TITULAR: "Titular" }), null);
  assert.deepEqual(transferAccount({ TRANSFER_CBU: "123", TRANSFER_ALIAS: "mi.alias", TRANSFER_TITULAR: "Titular" }), {
    numberLabel: "CBU",
    number: "",
    alias: "mi.alias",
    holder: "Titular",
    cuit: "",
  });
});

test("un número que empieza con 000 es un CVU", () => {
  const cuenta = transferAccount({
    TRANSFER_CBU: " 0000003100000000000001 ",
    TRANSFER_ALIAS: " mi.alias ",
    TRANSFER_TITULAR: "Titular",
    TRANSFER_CUIT: "20-11111111-1",
  });
  assert.deepEqual(cuenta, {
    numberLabel: "CVU",
    number: "0000003100000000000001",
    alias: "mi.alias",
    holder: "Titular",
    cuit: "20-11111111-1",
  });
});

test("un número de banco es un CBU", () => {
  assert.equal(
    transferAccount({ TRANSFER_CBU: "0110000000000000000001", TRANSFER_TITULAR: "Titular" })?.numberLabel,
    "CBU",
  );
});
