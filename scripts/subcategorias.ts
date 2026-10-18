/**
 * Crea subcategorías por tipo de producto en las categorías raíz que vinieron
 * de WooCommerce sin hijos (Aires Acondicionados, Herramientas, Drones, ...) y
 * completa la marca de los productos que quedaron como "General".
 *
 * Clasifica por el nombre del producto con las reglas de `PLAN` (primera regla
 * que coincide gana). Una subcategoría con menos de `MIN_PRODUCTOS` productos
 * no se crea: sus productos quedan solo en la categoría padre. Los productos
 * no salen del padre (el puente es N:N), así que la página del padre sigue
 * mostrando los mismos productos y sus URLs no cambian.
 *
 * Uso:
 *   npm run subcategorias               # modo prueba: lee la DB y muestra el plan, no escribe
 *   npm run subcategorias -- --apply    # escribe todo en una transacción
 *
 * Es idempotente: reusa subcategorías que ya existan bajo el mismo padre y no
 * duplica links del puente. Aborta si un slug nuevo ya lo usa otra categoría
 * (los slugs son únicos en toda la tabla).
 */
import "dotenv/config";

import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { categories, productCategories, products } from "@/db/schema";
import { marcaDesdeNombre } from "@/lib/brand-from-name";

const FALLBACK_BRAND = "General";
const MIN_PRODUCTOS = 3;

/** `min` pisa `MIN_PRODUCTOS` para una subcategoría que se quiere aunque sea chica. */
type Regla = { slug: string; name: string; match: RegExp; min?: number };
/** `rename` cambia el nombre visible del padre; el slug (y la URL) no cambia. */
type PlanCategoria = { parent: string; rename?: string; reglas: Regla[] };

/**
 * Reglas sobre el nombre normalizado (minúsculas, sin tildes), en orden: gana
 * la primera que coincide. Ajustadas con los nombres reales del catálogo
 * (salida del modo prueba del 9/10/2026). Los slugs llevan
 * prefijo o sufijo porque `computacion/sillas-gamer`, `computacion/joystick` y
 * `calefaccion` ya existen.
 */
export const PLAN: PlanCategoria[] = [
  {
    parent: "aires-acondicionados",
    reglas: [
      {
        slug: "calefaccion-y-caloventores",
        name: "Calefacción y Caloventores",
        match: /caloventor|calefactor|estufa|convector|radiador|panel calef|termoventilador/,
      },
      {
        slug: "ventiladores",
        name: "Ventiladores",
        match: /ventilador|circulador|climatizador|enfriador/,
      },
      {
        // Split, inverter y portátiles juntos: portátiles hay uno solo.
        slug: "equipos-de-aire-acondicionado",
        name: "Equipos de Aire Acondicionado",
        match: /aire acon|split|invert|portat?il|frio ?\/ ?calor/,
      },
    ],
  },
  {
    parent: "herramientas",
    reglas: [
      {
        slug: "taladros-y-atornilladores",
        name: "Taladros y Atornilladores",
        match: /taladro|atornillador|rotomartillo|percutor|llave de impacto/,
      },
      {
        slug: "amoladoras-y-lijadoras",
        name: "Amoladoras, Lijadoras y Lustradoras",
        match: /amoladora|pulidora|lijadora|lustra/,
      },
      { slug: "sierras-electricas", name: "Sierras", match: /sierra|caladora|ingletadora/ },
      { slug: "soldadoras", name: "Soldadoras", match: /soldador/ },
      {
        slug: "compresores-e-hidrolavadoras",
        name: "Hidrolavadoras, Infladores y Generadores",
        match: /compresor|hidrolavadora|inflador|grupo electrogeno|generador/,
      },
      { slug: "escaleras", name: "Escaleras", match: /escalera/ },
      { slug: "iluminacion-y-emergencia", name: "Iluminación", match: /luz de emergencia|plafon|reflector|lampara/ },
    ],
  },
  {
    parent: "drones",
    reglas: [
      {
        slug: "camaras-de-accion-y-gimbals",
        name: "Cámaras de Acción y Gimbals",
        match: /osmo|^dji rs ?\d|ronin|gimbal|estabilizador|action \d|pocket \d/,
      },
      { slug: "drones-con-camara", name: "Drones", match: /dron|mavic|avata|fpv/ },
    ],
  },
  {
    parent: "muebles",
    reglas: [
      { slug: "dormitorio", name: "Dormitorio", match: /box|plaza|cama|mesa de luz|placard|cajonera/ },
      { slug: "escritorios-y-mesas", name: "Escritorios y Mesas", match: /escritorio|mesa|desk/ },
      { slug: "racks-tv-y-bibliotecas", name: "Racks de TV y Bibliotecas", match: /rack|biblioteca|estante/ },
    ],
  },
  {
    parent: "consolas-playstation",
    // Tiene Nintendo Switch y Meta Quest, no solo PlayStation.
    rename: "Consolas y Gaming",
    reglas: [
      // Joysticks primero: "Joystick Sony Playstation 5" no es una consola.
      { slug: "joysticks-y-volantes", name: "Joysticks y Volantes", match: /joystick|dualsense|dualshock|volante/ },
      { slug: "consolas-ps", name: "Consolas", match: /consola|playstation \d|nintendo switch/ },
      { slug: "realidad-virtual", name: "Realidad Virtual", match: /meta quest|\bvr\b/, min: 1 },
    ],
  },
  {
    parent: "mochilas",
    // No tiene mochilas: son valijas, maletines y bandoleras.
    rename: "Valijas y Bolsos",
    reglas: [
      { slug: "valijas", name: "Valijas", match: /valija/ },
      { slug: "bolsos-y-maletines", name: "Bolsos y Maletines", match: /maletin|bandolera|bolso|mochila/ },
    ],
  },
  {
    parent: "electronica",
    reglas: [
      {
        slug: "enchufes-y-prolongadores",
        name: "Enchufes y Prolongadores",
        match: /prolongador|zapatilla|alargue|protector de tension|tomacorriente|enchufe/,
      },
      // Con 2 productos no se crea; `\bled\b` para no agarrar "Switch Oled".
      { slug: "iluminacion", name: "Iluminación", match: /luz de emergencia|lampara|linterna|\bled\b/ },
    ],
  },
  // Sin subcategorías: Monopatines (los 15 son monopatines), Juguetes (9 de 10
  // son lanzadores X-Shot), Handy (los 7 son handies Baofeng), Servidores (sin
  // productos) y Calefacción (uno solo). La diferencia es la marca o el modelo.
];

const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export function clasificar(nombre: string, reglas: Regla[]): Regla | null {
  const n = normalizar(nombre);
  return reglas.find((r) => r.match.test(n)) ?? null;
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const { db, pool } = await import("@/db");

  const filasCategorias = await db
    .select({ id: categories.id, slug: categories.slug, parentId: categories.parentId, icon: categories.icon })
    .from(categories);
  const porSlug = new Map(filasCategorias.map((c) => [c.slug, c]));

  type Asignacion = { regla: Regla; parentId: number; icon: string; productIds: number[]; nombres: string[] };
  const asignaciones: Asignacion[] = [];
  const renombres: { id: number; slug: string; name: string }[] = [];
  const marcas: { id: number; nombre: string; marca: string }[] = [];
  const conflictos: string[] = [];

  for (const plan of PLAN) {
    const padre = porSlug.get(plan.parent);
    if (!padre) {
      console.warn(`\n[subcategorias] '${plan.parent}' no existe en la DB, se saltea.`);
      continue;
    }

    const hijos = filasCategorias.filter((c) => c.parentId === padre.id);
    const ids = [padre.id, ...hijos.map((c) => c.id)];
    const filas = await db
      .selectDistinct({ id: products.id, name: products.name, brand: products.brand })
      .from(products)
      .innerJoin(productCategories, eq(productCategories.productId, products.id))
      .where(inArray(productCategories.categoryId, ids))
      .orderBy(products.name);

    const grupos = new Map<string, { regla: Regla; filas: typeof filas }>();
    const sinClasificar: string[] = [];
    for (const f of filas) {
      const regla = clasificar(f.name, plan.reglas);
      if (!regla) {
        sinClasificar.push(f.name);
      } else {
        const g = grupos.get(regla.slug) ?? { regla, filas: [] };
        g.filas.push(f);
        grupos.set(regla.slug, g);
      }
      if (!f.brand || f.brand === FALLBACK_BRAND) {
        const marca = marcaDesdeNombre(f.name);
        if (marca) marcas.push({ id: f.id, nombre: f.name, marca });
      }
    }

    console.log(`\n═══ ${plan.parent} · ${filas.length} productos ═══`);
    if (plan.rename) {
      console.log(`\n  ✎ Se renombra a "${plan.rename}" (la URL /categoria/${plan.parent} no cambia)`);
      renombres.push({ id: padre.id, slug: plan.parent, name: plan.rename });
    }
    for (const regla of plan.reglas) {
      const g = grupos.get(regla.slug);
      const n = g?.filas.length ?? 0;
      const min = regla.min ?? MIN_PRODUCTOS;
      const crea = n >= min;
      console.log(`\n  ${crea ? "✔" : "✘"} ${regla.name} (${regla.slug}) · ${n}${crea ? "" : ` · menos de ${min}, no se crea`}`);
      for (const f of g?.filas ?? []) console.log(`      - ${f.name}`);
      if (!crea || !g) continue;

      const existente = porSlug.get(regla.slug);
      if (existente && existente.parentId !== padre.id) {
        conflictos.push(`'${regla.slug}' ya existe bajo otra categoría (id ${existente.id})`);
        continue;
      }
      asignaciones.push({
        regla,
        parentId: padre.id,
        icon: padre.icon,
        productIds: g.filas.map((f) => f.id),
        nombres: g.filas.map((f) => f.name),
      });
    }
    if (sinClasificar.length) {
      console.log(`\n  · Quedan solo en la categoría padre (${sinClasificar.length}):`);
      for (const nombre of sinClasificar) console.log(`      - ${nombre}`);
    }
  }

  console.log(`\n═══ Marcas completadas desde el nombre: ${marcas.length} ═══`);
  for (const m of marcas) console.log(`  ${m.marca.padEnd(14)} ← ${m.nombre}`);

  if (conflictos.length) {
    console.error(`\n[subcategorias] slugs en conflicto, corregir PLAN antes de aplicar:\n  ${conflictos.join("\n  ")}`);
    await pool.end();
    process.exit(1);
  }

  if (!apply) {
    console.log("\n[subcategorias] modo prueba: no se escribió nada. Para aplicar: npm run subcategorias -- --apply");
    await pool.end();
    return;
  }

  await db.transaction(async (tx) => {
    for (const r of renombres) {
      await tx.update(categories).set({ name: r.name }).where(eq(categories.id, r.id));
      console.log(`[subcategorias] ${r.slug} renombrada a "${r.name}"`);
    }
    let orden = 0;
    for (const a of asignaciones) {
      orden += 1;
      const [cat] = await tx
        .insert(categories)
        .values({
          slug: a.regla.slug,
          name: a.regla.name,
          icon: a.icon,
          parentId: a.parentId,
          sortOrder: orden,
        })
        .onConflictDoUpdate({ target: categories.slug, set: { name: a.regla.name, parentId: a.parentId } })
        .returning({ id: categories.id });
      await tx
        .insert(productCategories)
        .values(a.productIds.map((productId) => ({ productId, categoryId: cat.id })))
        .onConflictDoNothing();
      console.log(`[subcategorias] ${a.regla.slug}: ${a.productIds.length} productos`);
    }
    for (const m of marcas) {
      await tx
        .update(products)
        .set({ brand: m.marca, updatedAt: sql`now()` })
        .where(and(eq(products.id, m.id), or(eq(products.brand, FALLBACK_BRAND), eq(products.brand, ""), isNull(products.brand))));
    }
    console.log(`[subcategorias] marcas actualizadas: ${marcas.length}`);
  });

  console.log("[subcategorias] listo. El menú y las páginas toman los cambios en hasta 5 minutos (caché).");
  await pool.end();
}

if (process.argv[1]?.endsWith("subcategorias.ts")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
