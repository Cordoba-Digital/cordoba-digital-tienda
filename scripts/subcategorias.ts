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

const FALLBACK_BRAND = "General";
const MIN_PRODUCTOS = 3;

type Regla = { slug: string; name: string; match: RegExp };
type PlanCategoria = { parent: string; reglas: Regla[] };

/**
 * Reglas sobre el nombre normalizado (minúsculas, sin tildes), en orden: gana
 * la primera que coincide. Los slugs llevan
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
        match: /ventilador|turbo ?ventilador|circulador|climatizador|enfriador/,
      },
      { slug: "aires-acondicionados-portatiles", name: "Aires Portátiles", match: /portat?il/ },
      {
        slug: "aires-acondicionados-split",
        name: "Aires Split / Inverter",
        match: /aire acondicionado|split|inverter|frio ?\/ ?calor/,
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
      { slug: "amoladoras-y-lijadoras", name: "Amoladoras y Lijadoras", match: /amoladora|pulidora|lijadora/ },
      { slug: "sierras-electricas", name: "Sierras", match: /sierra|caladora|ingletadora/ },
      { slug: "soldadoras", name: "Soldadoras", match: /soldador/ },
      {
        slug: "compresores-e-hidrolavadoras",
        name: "Compresores e Hidrolavadoras",
        match: /compresor|hidrolavadora|inflador/,
      },
      {
        slug: "herramientas-de-medicion",
        name: "Medición",
        match: /medidor|nivel laser|laser|multimetro|tester|pinza amperometrica|distanciometro/,
      },
      {
        slug: "herramientas-de-mano",
        name: "Herramientas de Mano",
        match: /destornillador|alicate|pinza|martillo|llave|juego de|set de|kit de|caja de herramientas/,
      },
    ],
  },
  {
    parent: "drones",
    reglas: [
      {
        slug: "accesorios-para-drones",
        name: "Accesorios para Drones",
        // Anclado al inicio: "DJI Mini 4 Pro con control RC 2" es un dron, no un accesorio.
        match: /^(bateria|helice|control|radio ?control|estuche|bolso|mochila|cargador|filtro|hub|goggles|gafas|protector|repuesto|kit|soporte|dji care)/,
      },
      { slug: "drones-con-camara", name: "Drones", match: /dron|mavic|mini \d|air \d|avata|neo|flip|fpv/ },
    ],
  },
  {
    parent: "muebles",
    reglas: [
      { slug: "sillas-de-oficina-y-gamer", name: "Sillas", match: /silla|butaca|sillon/ },
      { slug: "escritorios-y-mesas", name: "Escritorios y Mesas", match: /escritorio|mesa|desk/ },
      {
        slug: "estanterias-y-organizadores",
        name: "Estanterías y Organizadores",
        match: /estante|rack|biblioteca|organizador|cajonera|armario|placard/,
      },
    ],
  },
  {
    parent: "monopatines-electricos",
    reglas: [
      {
        slug: "accesorios-para-monopatines",
        name: "Accesorios para Monopatines",
        match: /^(casco|cubierta|neumatico|camara|cargador|bateria|candado|soporte|guardabarro|luz|repuesto)/,
      },
      { slug: "bicicletas-electricas", name: "Bicicletas Eléctricas", match: /bicicleta|bici/ },
      { slug: "monopatines", name: "Monopatines", match: /monopatin|scooter/ },
    ],
  },
  {
    parent: "consolas-playstation",
    reglas: [
      { slug: "consolas-ps", name: "Consolas", match: /consola|playstation \d (slim|pro|digital|standard)|ps\d (slim|pro|digital)/ },
      { slug: "joysticks-playstation", name: "Joysticks", match: /joystick|dualsense|dualshock|control/ },
      { slug: "juegos-playstation", name: "Juegos", match: /juego|game/ },
      { slug: "accesorios-playstation", name: "Accesorios", match: /auricular|headset|cargador|base|vr|portal|disco|cover/ },
    ],
  },
  // Electrónica, Mochilas, Juguetes, Servidores, Handy y Calefacción tienen
  // menos de 13 productos: subdividirlas deja subcategorías de 1 o 2 productos.
];

/**
 * Marcas que se buscan en el nombre cuando WooCommerce no la tenía cargada.
 * Se toma la que aparece primero en el nombre. La forma escrita acá es la que
 * se guarda.
 */
const MARCAS = [
  // Climatización
  "Samsung", "Hisense", "BGH", "Kanji", "Peabody", "Philco", "Surrey", "Midea", "LG", "Liliana",
  "Atma", "Electrolux", "TCL", "Noblex", "Gree", "Carrier", "York", "Whirlpool", "Axel",
  "Ultracomb", "Punktal", "Daewoo", "Westinghouse", "Sansei", "Siam", "Coventry", "Electra",
  "Telefunken", "Candy", "Enova", "Necchi", "Winco", "Smartlife", "Yelmo", "Magiclick", "Kacemaster",
  // Herramientas
  "Black+Decker", "Dewalt", "Makita", "Bosch", "Stanley", "Gamma", "Dowen Pagio", "Lusqtoff",
  "Einhell", "Skil", "Bauker", "Truper", "Niwa", "Barovo", "Ingco",
  // Drones, monopatines, consolas, handies, muebles
  "DJI", "Xiaomi", "Segway", "Ninebot", "Daihatsu", "Sony", "Baofeng", "Kenwood", "Motorola",
  "Yaesu", "Icom", "Retevis", "Cougar", "Corsair", "Redragon", "Logitech",
];

/** Variantes del nombre que también cuentan como la marca. */
const ALIAS: Record<string, string> = {
  "black & decker": "Black+Decker",
  "black and decker": "Black+Decker",
  "black decker": "Black+Decker",
  "de walt": "Dewalt",
  playstation: "Sony",
  dualsense: "Sony",
  dualshock: "Sony",
};

const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const PATRONES_MARCA: { re: RegExp; marca: string }[] = [
  ...MARCAS.map((m) => ({ re: new RegExp(`(^|[^a-z0-9])${escapar(normalizar(m))}([^a-z0-9]|$)`), marca: m })),
  ...Object.entries(ALIAS).map(([alias, marca]) => ({
    re: new RegExp(`(^|[^a-z0-9])${escapar(alias)}([^a-z0-9]|$)`),
    marca,
  })),
];

export function marcaDesdeNombre(nombre: string): string | null {
  const n = normalizar(nombre);
  let mejor: { pos: number; marca: string } | null = null;
  for (const { re, marca } of PATRONES_MARCA) {
    const m = re.exec(n);
    if (!m) continue;
    const pos = m.index + m[1].length;
    if (!mejor || pos < mejor.pos) mejor = { pos, marca };
  }
  return mejor?.marca ?? null;
}

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
    for (const regla of plan.reglas) {
      const g = grupos.get(regla.slug);
      const n = g?.filas.length ?? 0;
      const crea = n >= MIN_PRODUCTOS;
      console.log(`\n  ${crea ? "✔" : "✘"} ${regla.name} (${regla.slug}) · ${n}${crea ? "" : ` · menos de ${MIN_PRODUCTOS}, no se crea`}`);
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
