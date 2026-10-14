/**
 * Panel → Actividad: quien entró con ADMIN_PASSWORD se lee "Clave de
 * administrador", también en los movimientos guardados antes del cambio.
 *
 * Uso: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { activitySummary, actorName } from "../../src/lib/admin-actor";
import { adminActorLabel } from "../../src/lib/admin-auth";

test("el ingreso con la clave se muestra con nombre claro", () => {
  assert.equal(actorName(adminActorLabel(null)), "Clave de administrador");
  assert.equal(actorName("contraseña"), "Clave de administrador");
  assert.equal(actorName("duenio@example.com"), "duenio@example.com");
});

test("los ingresos viejos también se leen con la clave de administrador", () => {
  assert.equal(activitySummary("Ingresó con la contraseña"), "Ingresó con la clave de administrador");
  assert.equal(activitySummary("Editó el precio"), "Editó el precio");
});
