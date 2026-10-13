/**
 * Saneo del HTML de las descripciones (las edita el panel y vienen del
 * WordPress): nada de lo que pase puede ejecutar código en la tienda.
 *
 * Uso: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";

const { sanitizeHtml } = await import("../../src/lib/sanitize-html");

test("los links con javascript: escondido con entidades o espacios se quedan sin href", () => {
  for (const href of [
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    " javascript:alert(1)",
    "&#106;avascript:alert(1)",
    "&#106avascript:alert(1)",
    "java&#x09;script:alert(1)",
    "javascript&colon;alert(1)",
    "java&Tab;script:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
  ]) {
    assert.equal(sanitizeHtml(`<a href="${href}">x</a>`), "<a>x</a>", href);
  }
});

test("los links normales siguen andando, con el & bien escrito", () => {
  assert.equal(
    sanitizeHtml('<a href="https://www.cordobadigital.net/productos?marca=hp&amp;orden=precio">ver</a>'),
    '<a href="https://www.cordobadigital.net/productos?marca=hp&amp;orden=precio">ver</a>',
  );
  assert.equal(sanitizeHtml('<a href="/categoria/notebooks">a</a>'), '<a href="/categoria/notebooks">a</a>');
  assert.equal(sanitizeHtml('<a href="mailto:consultas@cordobadigital.net">b</a>'), '<a href="mailto:consultas@cordobadigital.net">b</a>');
  assert.equal(sanitizeHtml('<a href="tel:+543515555555">c</a>'), '<a href="tel:+543515555555">c</a>');
});

test("saca eventos, scripts y tags sin cerrar", () => {
  assert.equal(sanitizeHtml('<img src="x" alt="a" onerror="alert(1)"/>'), '<img src="x" alt="a" />');
  assert.equal(sanitizeHtml("<svg><script>alert(1)</script></svg>"), "");
  assert.equal(sanitizeHtml('<p title="><img src=x onerror=alert(1)>">t</p>'), "<p>t</p>");
  assert.equal(sanitizeHtml("<img src=x onerror=alert(1)//"), "&lt;img src=x onerror=alert(1)//");
  assert.equal(sanitizeHtml("<p>Precio < 100 mil</p>"), "<p>Precio &lt; 100 mil</p>");
});
