/**
 * Pruebas del saneador de artículos.
 *
 * Este HTML termina en `dangerouslySetInnerHTML`, así que acá se verifica que
 * entra lo que tiene que entrar y que NO entra nada capaz de ejecutar código o
 * de romper el diseño. Cada caso reproduce algo que aparece de verdad en los
 * artículos de Córdoba Digital.
 *
 * Uso: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { aTextoPlano, contarPalabras, primerSubtitulo, sanearGuia, separarPreambulo } from "../../scripts/lib/guia-html";

test("conserva la estructura de títulos y párrafos", () => {
  const salida = sanearGuia("<h2>Uno</h2><p>Texto <strong>grueso</strong>.</p><h3>Sub</h3><ul><li>Uno</li></ul>");
  assert.equal(salida, "<h2>Uno</h2>\n<p>Texto <strong>grueso</strong>.</p>\n<h3>Sub</h3>\n<ul><li>Uno</li></ul>");
});

test("saca el <style> y su contenido (el bug real de estos artículos)", () => {
  const entrada =
    '<html lang="es"><head><meta charset="utf-8"><style>body{background:red}p{color:blue}</style></head>' +
    "<body><p>El texto vale.</p></body></html>";
  const salida = sanearGuia(entrada);
  assert.ok(!salida.includes("style"), "no debe quedar <style>");
  assert.ok(!salida.includes("background:red"), "no debe quedar el CSS");
  assert.ok(!salida.includes("html"), "no debe quedar <html>");
  assert.ok(!salida.includes("meta"), "no debe quedar <meta>");
  assert.equal(salida, "<p>El texto vale.</p>");
});

test("descarta <script> con todo su contenido", () => {
  const salida = sanearGuia("<p>Antes</p><script>alert('x')</script><p>Después</p>");
  assert.ok(!salida.includes("script"));
  assert.ok(!salida.includes("alert"));
  assert.equal(salida, "<p>Antes</p>\n<p>Después</p>");
});

test("descarta iframes y embeds", () => {
  const salida = sanearGuia('<iframe src="https://malo.example"></iframe><p>Texto</p><embed src="x">');
  assert.ok(!salida.includes("iframe"));
  assert.ok(!salida.includes("embed"));
  assert.ok(salida.includes("Texto"));
});

test("borra todos los atributos salvo href", () => {
  const entrada =
    '<p style="color:red" class="x" onclick="robar()" data-y="1">Texto</p>' +
    '<div style="position:fixed"><span style="color:blue">Dentro</span></div>';
  const salida = sanearGuia(entrada);
  assert.ok(!salida.includes("style="), "no debe quedar style");
  assert.ok(!salida.includes("onclick"), "no debe quedar onclick");
  assert.ok(!salida.includes("class="), "no debe quedar class");
  assert.ok(!salida.includes("div"), "no debe quedar <div>");
  assert.ok(!salida.includes("span"), "no debe quedar <span>");
  assert.ok(salida.includes("Texto"));
  assert.ok(salida.includes("Dentro"), "el texto de un div se conserva");
});

test("neutraliza javascript: en los enlaces", () => {
  const salida = sanearGuia('<a href="javascript:alert(1)">Entrar</a>');
  assert.ok(!salida.includes("javascript:"), "no debe quedar javascript:");
  assert.ok(salida.includes("Entrar"));
});

test("reescribe las categorías de WooCommerce a las rutas de la tienda", () => {
  const salida = sanearGuia(
    '<a href="https://www.cordobadigital.net/categoria-producto/computacion/notebooks-cordoba/">Notebooks</a>',
  );
  assert.ok(salida.includes('href="/categoria/computacion/notebooks-cordoba"'), `salida: ${salida}`);
});

test("deja sin enlace lo que apunta afuera o a WordPress", () => {
  const salida = sanearGuia(
    '<a href="https://otro-sitio.example/x">Externo</a><a href="/wp-admin/">Admin</a><p>Bien</p>',
  );
  assert.ok(!salida.includes("otro-sitio.example"), "no debe quedar el dominio externo");
  assert.ok(!salida.includes("wp-admin"), "no debe quedar wp-admin");
  assert.ok(salida.includes("Externo"), "el texto del enlace se conserva");
  assert.ok(salida.includes("Bien"));
});

test("escapa el texto suelto para que no abra etiquetas", () => {
  const salida = sanearGuia("<p>5 &lt; 10 y 3 > 2</p>");
  assert.ok(salida.includes("&lt;"), `debe quedar escapado: ${salida}`);
  assert.ok(salida.includes("&gt;"));
  assert.equal(aTextoPlano(salida), "5 < 10 y 3 > 2");
});

test("no deja unbalanced el anidamiento aunque falten cierres", () => {
  const salida = sanearGuia("<ul><li>Uno<li>Dos</ul><p>Texto");
  assert.equal((salida.match(/<ul>/g) ?? []).length, (salida.match(/<\/ul>/g) ?? []).length);
  assert.equal((salida.match(/<li>/g) ?? []).length, (salida.match(/<\/li>/g) ?? []).length);
  assert.equal((salida.match(/<p>/g) ?? []).length, (salida.match(/<\/p>/g) ?? []).length);
});

test("cierra las etiquetas que quedaron abiertas", () => {
  const salida = sanearGuia("<p><strong>Sin cerrar");
  assert.equal(salida, "<p><strong>Sin cerrar</strong></p>");
});

test("ignora cierres sin apertura", () => {
  const salida = sanearGuia("<p>Texto</p></div></p>");
  assert.equal(salida, "<p>Texto</p>");
});

test("decodifica entidades y acentos", () => {
  assert.equal(aTextoPlano("C&oacute;rdoba &amp; M&aacute;s &mdash; 2026"), "Córdoba & Más — 2026");
  assert.equal(aTextoPlano("M&#243;vil &#x1F600;"), "Móvil 😀");
});

test("decodifica entidades numéricas dentro del artículo", () => {
  const salida = sanearGuia("<p>Tabla de 10&quot; y 15&nbsp;cm</p>");
  assert.equal(aTextoPlano(salida), 'Tabla de 10" y 15 cm');
});

test("mantiene las tablas de comparación", () => {
  const entrada =
    "<table><thead><tr><th>Modelo</th><th>Precio</th></tr></thead>" +
    "<tbody><tr><td>Air</td><td>100</td></tr></tbody></table>";
  const salida = sanearGuia(entrada);
  assert.ok(salida.includes("<table>"));
  assert.ok(salida.includes("<th>Modelo</th>"));
  assert.ok(salida.includes("<td>100</td>"));
  assert.equal((salida.match(/<tr>/g) ?? []).length, (salida.match(/<\/tr>/g) ?? []).length);
});

test("extrae el primer h2 como subtítulo", () => {
  assert.equal(primerSubtitulo("<h1>Título</h1><h2>GUÍA DEFINITIVA 2026</h2><p>x</p>"), "GUÍA DEFINITIVA 2026");
  assert.equal(primerSubtitulo("<p>sin h2</p>"), null);
});

test("cuenta palabras del artículo", () => {
  assert.equal(contarPalabras("<p>uno dos tres</p><p>cuatro</p>"), 4);
});

test("aguenta un artículo entero con HTML y CSS embebidos", () => {
  const realista =
    "<html><head><style>.x{color:red}</style></head><body>" +
    '<h2>Sección</h2><p>Texto con <strong>énfasis</strong> y <a href="https://www.cordobadigital.net/categoria-producto/impresoras-cordoba/">link</a>.</p>' +
    "<table><tr><th>A</th></tr><tr><td>1</td></tr></table>" +
    "<script>alert(1)</script></body></html>";
  const salida = sanearGuia(realista);
  assert.ok(!salida.includes("script"), "sin script");
  assert.ok(!salida.includes("style"), "sin style");
  assert.ok(!salida.includes("color:red"), "sin css");
  assert.ok(salida.includes('href="/categoria/impresoras-cordoba"'), "enlace reescrito");
  assert.ok(contarPalabras(salida) > 5, "el texto se conserva");
});

test("separa el preámbulo real de un artículo", () => {
  // Estructura exacta de los cinco artículos de Córdoba Digital.
  const entrada = [
    "GUÍA DEFINITIVA 2026",
    "GUÍA DEFINITIVA: CÓMO ELEGIR TU PRÓXIMA IMPRESORA EN ARGENTINA 2026",
    "Ecotank vs. Láser, análisis de TCO y manual de compra",
    "<strong>Publicado para:</strong> CordobaDigital.net/categoria-producto/impresoras-cordoba/ &nbsp;|&nbsp;",
    "<strong>Actualización:</strong> Tercer Trimestre 2026 &nbsp;|&nbsp;",
    "<strong>Cobertura:</strong> Argentina (Córdoba, CABA, Rosario, Mendoza)",
    "<h3>ÍNDICE DE CONTENIDOS</h3>",
    "<ul><li>Uno</li></ul>",
    "<h2>1. Estado del mercado</h2>",
    "<p>Cuerpo del artículo.</p>",
  ].join("\n");

  const { meta, cuerpo } = separarPreambulo(entrada);
  assert.equal(meta.etiqueta, "GUÍA DEFINITIVA 2026");
  assert.equal(meta.subtitulo, "GUÍA DEFINITIVA: CÓMO ELEGIR TU PRÓXIMA IMPRESORA EN ARGENTINA 2026");
  assert.equal(meta.descripcion, "Ecotank vs. Láser, análisis de TCO y manual de compra");
  assert.equal(meta.actualizacion, "Tercer Trimestre 2026");
  assert.equal(meta.cobertura, "Córdoba, CABA, Rosario, Mendoza");
  assert.equal(meta.categoria, "/categoria/impresoras-cordoba");
  assert.ok(cuerpo.startsWith("<h3>ÍNDICE"), `cuerpo: ${cuerpo.slice(0, 60)}`);
  assert.ok(!cuerpo.includes("GUÍA DEFINITIVA 2026"), "el preámbulo no va en el cuerpo");
  assert.ok(cuerpo.includes("Cuerpo del artículo"), "el cuerpo se conserva entero");
  assert.ok(!cuerpo.includes("categoria-producto"), "no queda la URL de WooCommerce");
});

test("el preámbulo no se come un artículo sin preámbulo", () => {
  const entrada = "<h2>1. Introducción</h2>\n<p>Texto directo.</p>";
  const { meta, cuerpo } = separarPreambulo(entrada);
  assert.equal(meta.etiqueta, "");
  assert.equal(meta.subtitulo, "");
  assert.equal(cuerpo, entrada, "sin preámbulo el cuerpo es el artículo entero");
});

test("arma la ruta de una categoría anidada del preámbulo", () => {
  const entrada = [
    "GUÍA ACTUALIZADA 2026",
    "GUÍA DEFINITIVA DE MACBOOKS EN ARGENTINA 2026",
    "Ecosistema Apple Silicon",
    "<strong>Publicado para:</strong> CordobaDigital.net/categoria-producto/computacion/notebooks-cordoba/apple-notebooks/ &nbsp;|&nbsp;",
    "<strong>Actualización:</strong> Tercer Trimestre 2026 (Inclusión de Chip M5) &nbsp;|&nbsp;",
    "<strong>Cobertura:</strong> Argentina (Córdoba, CABA, Rosario, Mendoza)",
    "<h2>1. Estado</h2>",
  ].join("\n");
  const { meta } = separarPreambulo(entrada);
  assert.equal(meta.categoria, "/categoria/computacion/notebooks-cordoba/apple-notebooks");
  assert.equal(meta.actualizacion, "Tercer Trimestre 2026 (Inclusión de Chip M5)");
  assert.equal(meta.etiqueta, "GUÍA ACTUALIZADA 2026");
});

test("reescribe también la URL de WooCommerce escrita como texto", () => {
  // El pie de cada artículo la tiene en texto pelado, no como href.
  const entrada =
    "<p>© 2026 CordobaDigital.net. Todos los derechos reservados.<br />\n" +
    "Publicado originalmente para la sección: " +
    "https://www.cordobadigital.net/categoria-producto/impresoras-cordoba/</p>";
  const salida = sanearGuia(entrada);
  assert.ok(!salida.includes("categoria-producto"), `no debe quedar la URL vieja: ${salida}`);
  assert.ok(!salida.includes("cordobadigital.net"), "no debe quedar el dominio viejo");
  assert.ok(salida.includes("/categoria/impresoras-cordoba"), `salida: ${salida}`);
});

test("reescribe una URL de categoría anidada escrita como texto", () => {
  const entrada =
    "<p>Publicado para: https://www.cordobadigital.net/categoria-producto/computacion/notebooks-cordoba/apple-notebooks/</p>";
  const salida = sanearGuia(entrada);
  assert.ok(salida.includes("/categoria/computacion/notebooks-cordoba/apple-notebooks"), `salida: ${salida}`);
});

test("una nota común del blog entra sin fotos ni bloques de WordPress, y con los enlaces de la tienda", () => {
  const entrada =
    "<p>El <strong>NFC</strong> sirve para pagar.</p>\n" +
    '<figure class="wp-block-image"><img src="https://www.cordobadigital.net/wp-content/uploads/2026/01/nfc.jpg" alt="NFC"/></figure>\n' +
    '<h2 class="wp-block-heading" id="como">¿Cómo se usa?</h2>\n' +
    '<div class="wp-block-buttons"><a class="wp-block-button__link" href="https://www.cordobadigital.net/categoria-producto/celulares/">Ver celulares</a></div>\n' +
    '<p>Mirá <a href="https://www.cordobadigital.net/producto/samsung-a36/">el A36</a> o <a href="https://www.cordobadigital.net/wp-content/uploads/x.pdf">el PDF</a>.</p>';
  const salida = sanearGuia(entrada);
  assert.ok(!/<img|<figure|<div|wp-content|categoria-producto|class=/.test(salida), salida);
  assert.ok(salida.includes('<a href="/categoria/celulares" rel="noopener">Ver celulares</a>'));
  assert.ok(salida.includes('<a href="/producto/samsung-a36" rel="noopener">el A36</a>'));
  assert.ok(salida.includes('<a href="#" rel="noopener">el PDF</a>'));
  // Sin preámbulo de guía: el cuerpo queda entero.
  assert.equal(separarPreambulo(salida).cuerpo, salida);
});
