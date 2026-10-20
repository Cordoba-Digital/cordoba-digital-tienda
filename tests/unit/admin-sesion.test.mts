/**
 * Panel: en producción la sesión del admin se firma solo con
 * ADMIN_SESSION_SECRET, nunca con la contraseña (se podría adivinar offline
 * desde una cookie). En local la contraseña sigue sirviendo de respaldo.
 *
 * Uso: npm test
 */
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { createAdminSessionValue, decodeAdminSession } from "../../src/lib/admin-auth";

const VARS = ["ADMIN_SESSION_SECRET", "ADMIN_PASSWORD", "VERCEL_ENV"] as const;
const antes = Object.fromEntries(VARS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const k of VARS) {
    if (antes[k] === undefined) delete process.env[k];
    else process.env[k] = antes[k];
  }
});

test("en producción sin ADMIN_SESSION_SECRET no se crean ni aceptan sesiones", async () => {
  process.env.ADMIN_PASSWORD = "clave-de-prueba";
  delete process.env.ADMIN_SESSION_SECRET;
  delete process.env.VERCEL_ENV;
  const firmadaConLaClave = await createAdminSessionValue();
  assert.ok(firmadaConLaClave, "en local la contraseña sirve de respaldo");

  process.env.VERCEL_ENV = "production";
  assert.equal(await createAdminSessionValue(), null);
  assert.equal(await decodeAdminSession(firmadaConLaClave), null);
});

test("en producción con ADMIN_SESSION_SECRET la sesión funciona y no la firma la contraseña", async () => {
  process.env.ADMIN_PASSWORD = "clave-de-prueba";
  process.env.VERCEL_ENV = "development";
  const firmadaConLaClave = await createAdminSessionValue();

  process.env.VERCEL_ENV = "production";
  process.env.ADMIN_SESSION_SECRET = "secreto-largo-de-prueba";
  const valor = await createAdminSessionValue("", true);
  assert.ok(valor);
  assert.equal((await decodeAdminSession(valor))?.remember, true);
  assert.equal(await decodeAdminSession(firmadaConLaClave), null);
});
