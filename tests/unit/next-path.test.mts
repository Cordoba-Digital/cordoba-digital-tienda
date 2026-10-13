/**
 * A dónde vuelve alguien después de ingresar (`?next=`): solo a páginas de la
 * tienda, nunca a otro sitio (redirección abierta para phishing).
 *
 * Uso: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { safeAdminPath, safeNextPath } from "../../src/lib/customer-session";

test("deja pasar paths internos", () => {
  assert.equal(safeNextPath("/mi-cuenta/pedidos"), "/mi-cuenta/pedidos");
  assert.equal(safeNextPath("/producto/notebook?color=negro"), "/producto/notebook?color=negro");
  assert.equal(safeNextPath("%2Fcarrito"), "/carrito");
});

test("rechaza cualquier cosa que el navegador lleve a otro sitio", () => {
  for (const raw of [
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "/%5Cevil.com",
    "/\t/evil.com",
    "/%09/evil.com",
    "/%0a/evil.com",
    "/%0d%0a/evil.com",
    "/ /evil.com",
    "javascript:alert(1)",
    "evil.com",
    "%E0%A4%A",
    "",
    null,
  ]) {
    assert.equal(safeNextPath(raw), "/mi-cuenta", String(raw));
  }
});

test("el panel solo vuelve a páginas del panel", () => {
  assert.equal(safeAdminPath("/admin/pedidos"), "/admin/pedidos");
  assert.equal(safeAdminPath("/admin?tab=hoy"), "/admin?tab=hoy");
  assert.equal(safeAdminPath("/mi-cuenta"), "/admin");
  assert.equal(safeAdminPath("/administracion-falsa"), "/admin");
  assert.equal(safeAdminPath("/%5Cevil.com"), "/admin");
  assert.equal(safeAdminPath("https://evil.com/admin"), "/admin");
});
