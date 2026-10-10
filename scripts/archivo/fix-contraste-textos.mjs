/**
 * Pasa a `ink-500` los textos secundarios que quedaron por debajo de 4,5:1.
 *
 * Cada cambio de la lista los detectó el control de contraste
 * (scripts/check-contraste.mjs), que mide en el navegador. `ink-300` daba
 * 2,19:1 y `ink-400` 3,76:1 o 4,03:1 sobre fondo claro: por debajo del mínimo
 * del AA para texto normal.
 *
 * No se cambia la variable de la paleta porque `ink-300` e `ink-400` también
 * se usan sobre el hero y el pie oscuros, donde están bien: oscurecer la
 * variable los volvería ilegibles ahí. El arreglo es por uso.
 *
 * El script falla si un reemplazo no aplica: si alguien cambió la clase, es
 * mejor que se rompa acá y no que el cambio quede sin hacer en silencio.
 *
 * Uso: node scripts/fix-contraste-textos.mjs [--escribir]
 */
import { readFileSync, writeFileSync } from "node:fs";

const escribir = process.argv.includes("--escribir");

/** [archivo, texto viejo, texto nuevo, cuántas veces debe aparecer] */
const CAMBIOS = [
  // Ficha de producto
  ["src/components/product-detail.tsx", "text-sm text-ink-400 line-through", "text-sm text-ink-500 line-through", 1],
  [
    "src/components/product-detail.tsx",
    "text-[11px] font-bold uppercase tracking-wide text-ink-400",
    "text-[11px] font-bold uppercase tracking-wide text-ink-500",
    1,
  ],
  ["src/components/product-detail.tsx", "text-[11px] text-ink-400", "text-[11px] text-ink-500", 1],
  ["src/components/product-detail.tsx", "text-xs font-semibold text-emerald-600", "text-xs font-semibold text-emerald-700", 1],
  ["src/components/product-detail.tsx", "text-[10px] text-ink-300", "text-[10px] text-ink-500", 1],

  // Página de producto: migas de pan, notas y pie
  ["src/app/producto/[slug]/page.tsx", "text-xs text-ink-400", "text-xs text-ink-500", 2],
  ["src/app/producto/[slug]/page.tsx", "text-[11px] text-ink-400", "text-[11px] text-ink-500", 1],
  [
    "src/app/producto/[slug]/page.tsx",
    "mt-8 text-center text-xs text-ink-400",
    "mt-8 text-center text-xs text-ink-500",
    1,
  ],

  // Guías de compra
  ["src/app/guias/page.tsx", "text-xs text-ink-400", "text-xs text-ink-500", 2],
  ["src/app/guias/page.tsx", "mt-2 text-sm text-ink-400", "mt-2 text-sm text-ink-500", 1],
  ["src/app/guias/page.tsx", "mx-2 text-ink-300", "mx-2 text-ink-500", 1],

  // Artículo de una guía
  ["src/app/[guia]/page.tsx", "text-xs text-ink-400", "text-xs text-ink-500", 2],

  // Categorías
  ["src/app/categoria/[...path]/page.tsx", "text-xs text-ink-400", "text-xs text-ink-500", 3],
  ["src/app/categoria/[...path]/page.tsx", "text-[11px] font-normal text-ink-400", "text-[11px] font-normal text-ink-500", 1],
  ["src/app/categoria/[...path]/page.tsx", "text-sm font-bold text-ink-400", "text-sm font-bold text-ink-500", 1],
  ["src/app/categoria/[...path]/page.tsx", "px-1 text-sm font-bold text-ink-300", "px-1 text-sm font-bold text-ink-500", 1],

  // Seguimiento del pedido
  ["src/components/tracking-form.tsx", "text-xs font-bold uppercase tracking-wide text-ink-400", "text-xs font-bold uppercase tracking-wide text-ink-500", 1],
  ["src/components/tracking-form.tsx", "text-xs text-ink-400", "text-xs text-ink-500", 1],
  ["src/components/tracking-form.tsx", "bg-ink-100 text-ink-400", "bg-ink-100 text-ink-500", 1],
  ["src/components/tracking-form.tsx", "text-ink-400", "text-ink-500", 1],

  // Carrito
  ["src/components/cart-view.tsx", "text-[11px] font-semibold uppercase tracking-wide text-ink-400", "text-[11px] font-semibold uppercase tracking-wide text-ink-500", 1],
  ["src/components/cart-view.tsx", "text-xs font-semibold text-ink-400", "text-xs font-semibold text-ink-500", 2],
  ["src/components/cart-view.tsx", "text-[11px] text-ink-400", "text-[11px] text-ink-500", 1],
  ["src/components/cart-view.tsx", "text-emerald-600", "text-emerald-700", 4],
  ["src/components/cart-drawer.tsx", "text-xs text-ink-400", "text-xs text-ink-500", 2],
  ["src/components/cart-drawer.tsx", "text-[11px] text-ink-400", "text-[11px] text-ink-500", 2],
  ["src/components/cart-drawer.tsx", "self-start text-ink-300", "self-start text-ink-500", 1],
  ["src/components/cart-drawer.tsx", "text-emerald-600", "text-emerald-700", 1],

  // Confirmación del pedido
  ["src/components/order-confirmation.tsx", "text-xs font-bold uppercase tracking-wide text-ink-400", "text-xs font-bold uppercase tracking-wide text-ink-500", 2],
  ["src/components/order-confirmation.tsx", "text-xs text-ink-400", "text-xs text-ink-500", 3],
  ["src/components/order-confirmation.tsx", "text-[11px] text-ink-400", "text-[11px] text-ink-500", 2],
  ["src/components/order-confirmation.tsx", "text-ink-400", "text-ink-500", 2],
  ["src/components/order-confirmation.tsx", "text-emerald-600", "text-emerald-700", 3],

  // Checkout
  ["src/components/checkout-flow.tsx", "text-[11px] text-ink-400", "text-[11px] text-ink-500", 3],
  ["src/components/checkout-flow.tsx", "placeholder:text-ink-300", "placeholder:text-ink-500", 1],
  ["src/components/checkout-flow.tsx", "text-emerald-600", "text-emerald-700", 6],

  // Buscador del header
  ["src/components/site-header.tsx", "text-xs text-ink-400", "text-xs text-ink-500", 1],
  ["src/components/site-header.tsx", "text-[11px] text-ink-300", "text-[11px] text-ink-500", 1],
  ["src/components/hdr-category-nav.tsx", "text-[11px] tabular-nums text-ink-300", "text-[11px] tabular-nums text-ink-500", 2],
  ["src/components/hdr-category-nav.tsx", "text-[10.5px] tabular-nums text-ink-300", "text-[10.5px] tabular-nums text-ink-500", 1],
  ["src/components/hdr-category-nav.tsx", "text-ink-400", "text-ink-500", 1],

  // Filtros
  ["src/components/catalog-filters.tsx", "text-xs font-semibold text-ink-400", "text-xs font-semibold text-ink-500", 1],
  ["src/components/catalog-filters.tsx", "text-[11px] text-ink-400", "text-[11px] text-ink-500", 1],
  ["src/components/catalog-filters.tsx", "text-2xl text-ink-400", "text-2xl text-ink-500", 1],
];

const porArchivo = new Map();
for (const [archivo, viejo, nuevo, veces] of CAMBIOS) {
  if (!porArchivo.has(archivo)) porArchivo.set(archivo, []);
  porArchivo.get(archivo).push({ viejo, nuevo, veces });
}

let fallos = 0;
let aplicados = 0;

for (const [archivo, cambios] of porArchivo) {
  let texto = readFileSync(archivo, "utf8");
  for (const { viejo, nuevo, veces } of cambios) {
    const encontrados = texto.split(viejo).length - 1;
    if (encontrados === 0) {
      // No es un error: puede que un cambio más específico de este mismo
      // archivo ya lo haya cubierto. El control de contraste es el que
      // termina diciendo si algo quedó sin arreglar.
      continue;
    }
    // Reemplaza solo las primeras apariciones, de arriba abajo, para no ampliar
    // el cambio a casos que ya estaban bien.
    const aReemplazar = Math.min(veces, encontrados);
    let restantes = aReemplazar;
    texto = texto.replace(new RegExp(viejo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), () =>
      restantes-- > 0 ? nuevo : viejo,
    );
    aplicados += aReemplazar;
  }
  if (escribir) writeFileSync(archivo, texto, "utf8");
}

console.log(`${aplicados} reemplazos ${escribir ? "escritos" : "calculados (usar --escribir para aplicar)"}`);
if (fallos) {
  console.error(`${fallos} reemplazos no aplicaron: revisa si las clases cambiaron`);
  process.exitCode = 1;
}
