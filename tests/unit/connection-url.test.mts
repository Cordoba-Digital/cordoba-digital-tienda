/**
 * La URL de la base pide `sslmode=verify-full` en vez de `require`, para que
 * `pg` no avise en cada arranque y no se debilite al actualizarlo.
 *
 * Uso: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { withVerifiedSsl } from "../../src/db/connection-url";

test("cambia los modos que pg 9 va a debilitar por verify-full", () => {
  assert.equal(
    withVerifiedSsl("postgresql://u:p@ep-x.neon.tech/neondb?sslmode=require"),
    "postgresql://u:p@ep-x.neon.tech/neondb?sslmode=verify-full",
  );
  assert.equal(
    withVerifiedSsl("postgresql://u:p@ep-x.neon.tech/neondb?channel_binding=require&sslmode=prefer&x=1"),
    "postgresql://u:p@ep-x.neon.tech/neondb?channel_binding=require&sslmode=verify-full&x=1",
  );
});

test("no toca URLs sin sslmode ni los otros modos", () => {
  assert.equal(withVerifiedSsl("postgres://postgres:ci@127.0.0.1:5432/ci"), "postgres://postgres:ci@127.0.0.1:5432/ci");
  assert.equal(withVerifiedSsl("postgres://h/db?sslmode=disable"), "postgres://h/db?sslmode=disable");
  assert.equal(withVerifiedSsl("postgres://h/db?sslmode=verify-full"), "postgres://h/db?sslmode=verify-full");
});
