/**
 * Limpia las categorías heredadas de WooCommerce:
 *
 * 1. Fusiona las de `CATEGORY_MERGES` (duplicados y subcategorías de marca con
 *    1 a 3 productos): sus productos pasan a la categoría destino, la marca se
 *    completa en los que no la tenían y la categoría vieja se borra. La página
 *    de categoría redirige la URL vieja (ver `src/lib/category-merges.ts`).
 * 2. Completa la marca de los productos de las subcategorías de marca que se
 *    quedan (Notebooks HP, Celulares Samsung, Réflex Canon, ...), para que el
 *    filtro de marca los encuentre.
 *
 * Solo toca productos con marca vacía o "General"; los que tienen otra marca
 * se listan para revisarlos a mano. La marca se escribe con la forma que ya
 * exista en la base ("Hp" si así está cargada) para no partir el filtro.
 *
 * Uso:
 *   npm run categorias:limpiar               # modo prueba: muestra el plan, no escribe
 *   npm run categorias:limpiar -- --apply    # aplica todo en una transacción
 *
 * Es idempotente: una fusión cuya categoría vieja ya no existe se saltea.
 */
import "dotenv/config";

import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { categories, productCategories, products } from "@/db/schema";
import { CATEGORY_MERGES, mergedCategoryRedirect } from "@/lib/category-merges";
import { buildCategoryTree, flattenTree, type CategoryRow } from "@/lib/category-tree";

const FALLBACK_BRAND = "General";

/** Subcategorías de marca que se quedan (tienen volumen y búsquedas propias). */
const SUBCATEGORIAS_DE_MARCA: Record<string, string> = {
  "computacion/notebooks-cordoba/apple-notebooks": "Apple",
  "computacion/notebooks-cordoba/hp-notebooks": "HP",
  "computacion/notebooks-cordoba/notebooks-lenovo": "Lenovo",
  "computacion/notebooks-cordoba/msi": "MSI",
  "computacion/notebooks-cordoba/dell": "Dell",
  "celulares-cordoba/xiaomi-cordoba": "Xiaomi",
  "celulares-cordoba/samsung": "Samsung",
  "celulares-cordoba/motorola": "Motorola",
  "celulares-cordoba/iphone-cordoba": "Apple",
  "celulares-cordoba/infinix": "Infinix",
  "celulares-cordoba/realme": "Realme",
  "camaras-digitales/camaras-reflex/nikon": "Nikon",
  "camaras-digitales/camaras-reflex/canon": "Canon",
  "camaras-digitales/camaras-reflex/sony-camaras-reflex": "Sony",
};

const sinMarca = (brand: string | null) => !brand || brand === FALLBACK_BRAND;

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const { db, pool } = await import("@/db");

  const filas = (await db.select().from(categories)) as CategoryRow[];
  const porRuta = new Map(flattenTree(buildCategoryTree(filas)).map((n) => [n.path, n]));

  // Forma de cada marca tal como ya está en la base, por minúsculas.
  const marcasExistentes = await db.selectDistinct({ brand: products.brand }).from(products);
  const formaDeMarca = new Map(marcasExistentes.map((m) => [m.brand.toLowerCase(), m.brand]));
  const marcaCanonica = (marca: string) => formaDeMarca.get(marca.toLowerCase()) ?? marca;

  const productosDe = (categoryId: number) =>
    db
      .selectDistinct({ id: products.id, name: products.name, brand: products.brand, categorySlug: products.categorySlug })
      .from(products)
      .innerJoin(productCategories, eq(productCategories.productId, products.id))
      .where(eq(productCategories.categoryId, categoryId))
      .orderBy(products.name);

  type Fusion = { fromId: number; fromSlug: string; intoId: number; intoSlug: string; productIds: number[] };
  const fusiones: Fusion[] = [];
  const marcas = new Map<number, string>();
  const errores: string[] = [];

  console.log("═══ Fusiones ═══");
  for (const merge of CATEGORY_MERGES) {
    const from = porRuta.get(merge.from);
    const into = porRuta.get(merge.into);
    if (!from) {
      console.log(`\n  · ${merge.from}: ya no existe, se saltea`);
      continue;
    }
    if (!into) {
      errores.push(`destino '${merge.into}' no existe (para '${merge.from}')`);
      continue;
    }
    if (from.children.length) {
      errores.push(`'${merge.from}' tiene subcategorías, no se puede fusionar así`);
      continue;
    }

    const prods = await productosDe(from.id);
    const marca = merge.marca ? marcaCanonica(merge.marca) : null;
    console.log(`\n  ${from.name} (${merge.from}) → ${into.name} (${merge.into}) · ${prods.length} productos · ${merge.motivo}`);
    console.log(`    redirige a ${mergedCategoryRedirect(merge.from)}`);
    for (const p of prods) {
      let nota = "";
      if (marca && sinMarca(p.brand)) {
        marcas.set(p.id, marca);
        nota = ` · marca: ${p.brand || "(vacía)"} → ${marca}`;
      } else if (marca && p.brand.toLowerCase() !== marca.toLowerCase()) {
        nota = ` · ⚠ marca cargada "${p.brand}", no aparece con el filtro ${marca}`;
      }
      const principal = p.categorySlug === from.slug ? ` · principal → ${into.slug}` : "";
      console.log(`      - ${p.name}${principal}${nota}`);
    }
    fusiones.push({ fromId: from.id, fromSlug: from.slug, intoId: into.id, intoSlug: into.slug, productIds: prods.map((p) => p.id) });
  }

  console.log("\n═══ Marca en subcategorías de marca que se quedan ═══");
  for (const [ruta, marcaBase] of Object.entries(SUBCATEGORIAS_DE_MARCA)) {
    const nodo = porRuta.get(ruta);
    if (!nodo) {
      console.log(`\n  · ${ruta}: no existe, se saltea`);
      continue;
    }
    const marca = marcaCanonica(marcaBase);
    const prods = await productosDe(nodo.id);
    const completar = prods.filter((p) => sinMarca(p.brand));
    const otras = prods.filter((p) => !sinMarca(p.brand) && p.brand.toLowerCase() !== marca.toLowerCase());
    console.log(`\n  ${nodo.name} (${ruta}) · ${prods.length} productos · ${completar.length} sin marca → ${marca}`);
    for (const p of completar) {
      marcas.set(p.id, marca);
      console.log(`      + ${p.name}`);
    }
    for (const p of otras) console.log(`      ⚠ ${p.name} · marca cargada "${p.brand}"`);
  }

  if (errores.length) {
    console.error(`\n[limpiar-categorias] corregir CATEGORY_MERGES antes de aplicar:\n  ${errores.join("\n  ")}`);
    await pool.end();
    process.exit(1);
  }

  console.log(`\nResumen: ${fusiones.length} categorías se fusionan, ${marcas.size} productos reciben marca.`);

  if (!apply) {
    console.log("\n[limpiar-categorias] modo prueba: no se escribió nada. Para aplicar: npm run categorias:limpiar -- --apply");
    await pool.end();
    return;
  }

  await db.transaction(async (tx) => {
    for (const f of fusiones) {
      if (f.productIds.length) {
        await tx
          .insert(productCategories)
          .values(f.productIds.map((productId) => ({ productId, categoryId: f.intoId })))
          .onConflictDoNothing();
      }
      await tx.delete(productCategories).where(eq(productCategories.categoryId, f.fromId));
      await tx
        .update(products)
        .set({ categorySlug: f.intoSlug, updatedAt: sql`now()` })
        .where(eq(products.categorySlug, f.fromSlug));
      await tx.delete(categories).where(eq(categories.id, f.fromId));
      console.log(`[limpiar-categorias] ${f.fromSlug} → ${f.intoSlug}: ${f.productIds.length} productos`);
    }
    const porMarca = new Map<string, number[]>();
    for (const [id, marca] of marcas) porMarca.set(marca, [...(porMarca.get(marca) ?? []), id]);
    for (const [marca, ids] of porMarca) {
      await tx
        .update(products)
        .set({ brand: marca, updatedAt: sql`now()` })
        .where(and(inArray(products.id, ids), or(eq(products.brand, FALLBACK_BRAND), eq(products.brand, ""), isNull(products.brand))));
    }
    console.log(`[limpiar-categorias] marcas completadas: ${marcas.size}`);
  });

  console.log("[limpiar-categorias] listo. El menú y las páginas toman los cambios en hasta 5 minutos (caché).");
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
