/**
 * Orden de los bloques de la home que se elige en Panel → Inicio. Lo guardado
 * o lo que manda el panel pasa siempre por `parseHomeLayout`: una lista rota
 * no puede dejar la home sin portada ni con bloques inventados.
 *
 * Uso: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { defaultHomeLayout, HOME_BLOCKS, parseHomeLayout, parseTopBar, visibleHomeBlocks } from "../../src/lib/home-layout";

const TODOS = HOME_BLOCKS.map((b) => b.id);

test("sin nada guardado la home intercala productos y vitrinas, y lo que la alargaba arranca oculto", () => {
  assert.deepEqual(visibleHomeBlocks(defaultHomeLayout()), [
    "portada",
    "vistos",
    "categorias",
    "ofertas",
    "vitrinas",
    "mas-vendidos",
    "vitrinas-2",
    "por-categoria",
    "pagos-retiro",
    "destacados",
  ]);
  assert.equal(defaultHomeLayout().length, TODOS.length);
  assert.deepEqual(parseHomeLayout(null), defaultHomeLayout());
  assert.deepEqual(parseHomeLayout({ blocks: [] }), defaultHomeLayout());
});

test("respeta el orden y lo oculto, y la portada queda primera aunque la manden al final", () => {
  const layout = parseHomeLayout([
    { id: "ofertas", visible: true },
    { id: "local", visible: false },
    { id: "portada", visible: false },
  ]);
  assert.deepEqual(layout[0], { id: "portada", visible: true });
  const ids = layout.map((item) => item.id);
  assert.ok(ids.indexOf("ofertas") < ids.indexOf("local"));
  assert.deepEqual(layout.find((item) => item.id === "local"), { id: "local", visible: false });
  assert.equal(layout.length, TODOS.length);
  assert.ok(!visibleHomeBlocks(layout).includes("local"));
});

test("ignora bloques desconocidos y repetidos", () => {
  const layout = parseHomeLayout([{ id: "guias" }, { id: "<script>" }, { id: "guias", visible: false }, "ofertas", null]);
  assert.deepEqual(layout.find((item) => item.id === "guias"), { id: "guias", visible: true });
  assert.equal(layout.filter((item) => item.id === "guias").length, 1);
  assert.deepEqual(new Set(layout.map((item) => item.id)), new Set(TODOS));
});

test("un bloque nuevo que no estaba guardado aparece en su lugar, no al final, con su visibilidad de entrada", () => {
  const guardado = defaultHomeLayout().filter((item) => item.id !== "vitrinas" && item.id !== "guias");
  const layout = parseHomeLayout(guardado);
  assert.deepEqual(layout, defaultHomeLayout());
});

test("con un orden viejo guardado, los bloques nuevos entran después de su vecino y se respeta lo demás", () => {
  // Así quedó guardada la home antes de sumar "vistos", "por-categoria" y "explorar".
  const viejo = ["accesos", "categorias", "ofertas", "pagos-retiro", "mas-vendidos", "local", "destacados", "guias", "preguntas"].map(
    (id) => ({ id, visible: id !== "local" }),
  );
  const layout = parseHomeLayout(viejo);
  // Lo que ya estaba guardado visible sigue visible ("explorar" no estaba y
  // arranca oculto); las vitrinas nuevas entran entre las filas de productos.
  assert.deepEqual(visibleHomeBlocks(layout), [
    "portada",
    "vistos",
    "accesos",
    "categorias",
    "ofertas",
    "vitrinas",
    "pagos-retiro",
    "mas-vendidos",
    "vitrinas-2",
    "por-categoria",
    "destacados",
    "guias",
    "preguntas",
  ]);
  assert.deepEqual(layout.find((item) => item.id === "local"), { id: "local", visible: false });
  assert.equal(layout.length, TODOS.length);
});

test("la barra de avisos se muestra salvo que esté guardada como oculta", () => {
  assert.equal(parseTopBar(undefined), true);
  assert.equal(parseTopBar(null), true);
  assert.equal(parseTopBar({ visible: true }), true);
  assert.equal(parseTopBar({ visible: "false" }), true);
  assert.equal(parseTopBar({ visible: false }), false);
});
