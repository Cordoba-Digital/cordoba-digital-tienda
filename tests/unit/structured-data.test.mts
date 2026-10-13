/**
 * JSON-LD que va en todas las páginas: la tienda online con su logo y sus
 * redes, y el sitio con el buscador del catálogo.
 *
 * Uso: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { organizationAndWebsite, ORG_ID, WEBSITE_ID } from "../../src/lib/structured-data";

const [tienda, sitio] = organizationAndWebsite()["@graph"] as Record<string, unknown>[];

test("la empresa es una tienda online con logo y redes", () => {
  assert.equal(tienda["@type"], "OnlineStore");
  assert.equal(tienda["@id"], ORG_ID);
  assert.match(String(tienda.logo), /^https:\/\/.+\/images\/logo\.png$/);
  assert.ok(Array.isArray(tienda.sameAs) && tienda.sameAs.length > 0);
});

test("el sitio declara el buscador del catálogo", () => {
  assert.equal(sitio["@id"], WEBSITE_ID);
  const accion = sitio.potentialAction as { "@type": string; target: { urlTemplate: string }; "query-input": string };
  assert.equal(accion["@type"], "SearchAction");
  assert.match(accion.target.urlTemplate, /\/productos\?q=\{search_term_string\}$/);
  assert.equal(accion["query-input"], "required name=search_term_string");
});
