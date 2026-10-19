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

test("el panel acepta un CVU válido y rechaza uno con un dígito mal", async () => {
  const { isValidCbu } = await import("../../src/lib/transfer-account");
  assert.equal(isValidCbu("0000267900000000883645"), true);
  assert.equal(isValidCbu("2850590940090418135201"), true);
  assert.equal(isValidCbu("0000267900000000883646"), false);
  assert.equal(isValidCbu("0000267910000000883645"), false);
  assert.equal(isValidCbu("000026790000000088364"), false);
});

test("el panel limpia los datos y arma el CUIT con guiones", async () => {
  const { validateTransferInput } = await import("../../src/lib/transfer-account");
  const result = validateTransferInput({
    number: " 0000267900000000883645 ",
    alias: " Mi.Alias ",
    holder: "  Juana   Pérez ",
    cuit: "27-12345678-9",
  });
  assert.deepEqual(result, {
    ok: true,
    value: { number: "0000267900000000883645", alias: "mi.alias", holder: "Juana Pérez", cuit: "27-12345678-9" },
  });
});

test("el panel rechaza alias, titular o CUIT inválidos", async () => {
  const { validateTransferInput } = await import("../../src/lib/transfer-account");
  const base = { number: "0000267900000000883645", alias: "mi.alias", holder: "Juana Pérez", cuit: "" };
  assert.equal(validateTransferInput(base).ok, true);
  assert.equal(validateTransferInput({ ...base, number: "123" }).ok, false);
  assert.equal(validateTransferInput({ ...base, alias: "abc" }).ok, false);
  assert.equal(validateTransferInput({ ...base, alias: "con espacio" }).ok, false);
  assert.equal(validateTransferInput({ ...base, holder: "" }).ok, false);
  assert.equal(validateTransferInput({ ...base, cuit: "123" }).ok, false);
  assert.equal(validateTransferInput(null).ok, false);
});
