/**
 * Sincroniza precios desde WooCommerce y reporta el diff.
 *
 * Por qué existe: los precios se copiaron una vez en `migrate:wp`, pero el
 * cliente los va cambiando (promociones que entran y salen). Sin esto, el
 * deploy queda mostrando precios viejos sin que nadie se entere. Con 2.588
 * productos no es un trabajo manual.
 *
 * Solo toca `price` y `compare_at_price`. NO toca stock, categorías, imágenes,
 * descripciones ni precios de lista si no cambiaron. Esa restricción es
 * deliberada: `migrate:wp` completo ya reescribe todo el catálogo y arrastra
 * riesgos innecesarios para lo que solo es un ajuste de precios.
 *
 * Uso:
 *   npm run sync:precios -- --dry-run          # solo informa el diff
 *   npm run sync:precios -- --apply            # escribe
 *   npm run sync:precios -- --apply --add-missing   # además crea los productos nuevos
 *
 * Envs: WC_STORE_URL (default), DATABASE_URL (requerida)
 */
import "dotenv/config";

import { eq, sql } from "drizzle-orm";

import { categories, productCategories, products } from "@/db/schema";

const STORE_URL = (process.env.WC_STORE_URL ?? "https://www.cordobadigital.net").replace(/\/+$/, "");
/** El server WP bloquea requests sin UA moderno (403 "Your browser is outdated"). */
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const PER_PAGE = 100;
const TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;

const argv = process.argv.slice(2);
const dryRun = !argv.includes("--apply");
const addMissing = argv.includes("--add-missing");

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

type StoreProduct = {
  id: number;
  slug: string;
  name: string;
  sku?: string;
  on_sale: boolean;
  is_in_stock: boolean;
  prices: { price: string; regular_price: string; currency_code: string };
  images?: { src: string; srcset?: string }[];
  brands?: { name: string }[];
  categories?: { id: number; slug: string; name: string }[];
};

// ─── Fetch ───────────────────────────────────────────────────────────

async function fetchPage(page: number): Promise<{ items: StoreProduct[]; total: number }> {
  const url = `${STORE_URL}/wp-json/wc/store/v1/products?per_page=${PER_PAGE}&page=${page}`;
  let lastMessage = "desconocido";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": UA, accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const total = Number(res.headers.get("x-wp-total") ?? 0);
      const items = (await res.json()) as StoreProduct[];
      if (!Array.isArray(items)) throw new Error("respuesta no es un array");
      return { items, total };
    } catch (error) {
      lastMessage = (error as Error).message;
      if (attempt < MAX_ATTEMPTS) {
        const backoff = 500 * 2 ** (attempt - 1);
        console.error(`[sync] página ${page}: ${lastMessage} — reintento ${attempt + 1}/${MAX_ATTEMPTS}`);
        await sleep(backoff);
      }
    }
  }
  throw new Error(`página ${page}: ${lastMessage}`);
}

async function fetchAll(): Promise<{ items: StoreProduct[]; total: number }> {
  const first = await fetchPage(1);
  const total = first.total || first.items.length;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const items: StoreProduct[] = [...first.items];

  for (let page = 2; page <= totalPages; page++) {
    const { items: data } = await fetchPage(page);
    if (data.length) items.push(...data);
    process.stdout.write(`\r  leídos ${items.length}/${total}   `);
  }
  process.stdout.write("\n");
  return { items, total };
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * WooCommerce y nuestra base usan **el mismo entero** para el precio (por
 * ejemplo `3299999`), pero cada uno lo interpreta con una escala distinta:
 *
 * - WooCommerce lo muestra como $3.299.999 (pesos).
 * - Nuestra `money()` lo muestra como $33.000, porque divide entre 100 y lo
 *   llama "centavos" (ver `src/lib/format.ts`).
 *
 * Verificado contra `/producto/iphone-18-pro-max-512gb`: el número crudo es
 * idéntico en los dos lados. Por eso la conversión es un simple redondeo y
 * **no** hay que multiplicar por 100: hacerlo dejaba los 2.588 productos con
 * precio distinto.
 *
 * Este es un bug de formato heredado de la migración, no del sync. Corregir
 * la escala requiere tocar `money()`, `transferPrice()`, las cuotas y los
 * importes de Mercado Pago, así que va aparte: acá se preserva tal cual para
 * que el sync no mezcle dos temas.
 */
const toCents = (value: string | undefined | null): number | null => {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
};

/**
 * Cómo lo ve el cliente en la web de WooCommerce: el entero son pesos.
 * Se usa solo para el reporte, para poder comparar contra la captura de
 * pantalla; los valores que se escriben en la base van sin escalar.
 */
const money = (n: number): string =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

type Db = typeof import("@/db").db;

type Diff = {
  slug: string;
  nombre: string;
  nuestro: number;
  woo: number;
  listaNuestra: number | null;
  listaWoo: number | null;
};

/**
 * Profundidad de una categoría en el árbol local (0 = raíz). Se usa para elegir
 * la categoría principal del producto nuevo: la más cercana a la raíz, que es
 * la que el visitante ve en la barra de navegación.
 *
 * `db` se pasa por parámetro a propósito: es un import dinámico dentro de
 * `main()`, así que no está disponible en el scope del módulo. Se usa `select`
 * en vez de `db.query` porque el cliente de drizzle de este proyecto no tiene
 * la API `query` tipada.
 */
async function depthOf(db: Db, slug: string): Promise<number> {
  // SQL directo: `db` se crea con `drizzle(pool)` sin el schema, así que el
  // builder no hereda los tipos y `db.select(...)` no compila. La consulta es
  // de solo lectura sobre 128 filas.
  const res = await db.execute<{ id: number; slug: string; parent_id: number | null }>(
    sql`SELECT id, slug, parent_id FROM categories`,
  );
  const rows = res.rows;
  const byId = new Map(rows.map((c) => [c.id, c]));
  const bySlug = new Map(rows.map((c) => [c.slug, c]));
  let depth = 0;
  let cur = bySlug.get(slug);
  const seen = new Set<number>();
  while (cur?.parent_id && byId.has(cur.parent_id) && !seen.has(cur.parent_id)) {
    seen.add(cur.parent_id);
    cur = byId.get(cur.parent_id);
    depth += 1;
  }
  return depth;
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  const { db } = await import("@/db");

  console.log(`[sync] ${dryRun ? "DRY RUN (no escribe)" : "ESCRIBIENDO"} · ${STORE_URL}`);
  const { items: remote, total } = await fetchAll();
  console.log(`[sync] ${remote.length} productos en WooCommerce (x-wp-total: ${total})`);

  const actuales = await db.select().from(products);
  const porSlug = new Map(actuales.map((p) => [p.slug, p]));
  console.log(`[sync] ${actuales.length} productos en la base`);

  const cambios: Diff[] = [];
  const nuevos: StoreProduct[] = [];
  let soloPrecio = 0;
  let conLista = 0;

  for (const rp of remote) {
    const nuestro = porSlug.get(rp.slug);
    if (!nuestro) {
      nuevos.push(rp);
      continue;
    }

    const woo = toCents(rp.prices.price);
    if (woo === null) continue;

    // WooCommerce devuelve `regular_price` == `price` cuando el producto NO
    // está en oferta. Guardar esa lista igual al precio pinta un tachado sobre
    // sí mismo ("$3.299.999  $3.299.999"), que es lo que veía el iPhone.
    // Sin oferta, la lista va en null y no se muestra tachado.
    const regBruto = toCents(rp.prices.regular_price);
    const listaWoo = regBruto !== null && regBruto > woo ? regBruto : null;
    const listaCambia = listaWoo !== nuestro.compareAtPrice;
    const cambia = nuestro.price !== woo;

    if (!cambia && !listaCambia) continue;

    cambios.push({
      slug: rp.slug,
      nombre: rp.name,
      nuestro: nuestro.price,
      woo,
      listaNuestra: nuestro.compareAtPrice,
      listaWoo,
    });
    if (cambia) soloPrecio += 1;
    if (listaCambia) conLista += 1;
  }

  const enBaseSinWP = actuales.filter((p) => !remote.some((r) => r.slug === p.slug));

  // Guarda contra el error de unidades: si más de la mitad de los productos
  // "cambiara" de golpe, lo más probable es que se comparen pesos contra
  // centavos, no que el cliente haya repriced el catálogo entero.
  if (cambios.length > Math.max(20, actuales.length * 0.5)) {
    console.error(
      `\n[sync] ABORTA: ${cambios.length} de ${actuales.length} productos cambiarían. ` +
        `Casi seguro es un error de unidades (pesos vs centavos). No se escribe nada.`,
    );
    process.exit(1);
  }

  console.log(`\n[sync] precios a actualizar: ${cambios.length} (de los cuales ${soloPrecio} cambian el precio de venta)`);
  console.log(`[sync] en la base pero ya no están en WooCommerce: ${enBaseSinWP.length}`);
  if (nuevos.length) console.log(`[sync] productos nuevos en WooCommerce: ${nuevos.length}`);

  if (cambios.length) {
    console.log("\n  producto                                      nuestro        WooCommerce   lista");
    for (const d of cambios.slice(0, 30)) {
      const lista = d.listaWoo === null ? "-" : money(d.listaWoo);
      console.log(
        `  ${d.slug.slice(0, 44).padEnd(44)} ${money(d.nuestro).padStart(12)} ${money(d.woo).padStart(12)} ${lista.padStart(12)}`,
      );
    }
    if (cambios.length > 30) console.log(`  … y ${cambios.length - 30} más`);
  }

  for (const n of nuevos.slice(0, 10)) console.log(`  NUEVO: ${n.slug}`);

  if (dryRun) {
    console.log("\n[sync] dry run: no se escribió nada. Usá --apply para escribir.");
    return;
  }

  let escritos = 0;
  for (const d of cambios) {
    await db
      .update(products)
      .set({
        price: d.woo,
        // Si WooCommerce ya no publica un precio de lista, no queda tachado.
        compareAtPrice: d.listaWoo,
      })
      .where(eq(products.slug, d.slug));
    escritos += 1;
    process.stdout.write(`\r  escritos ${escritos}/${cambios.length}   `);
  }
  process.stdout.write("\n");
  console.log(`[sync] precios actualizados: ${escritos}`);

  if (nuevos.length && addMissing) {
    console.log(`[sync] creando ${nuevos.length} producto(s) nuevo(s)…`);
    for (const n of nuevos) {
      const price = toCents(n.prices.price) ?? 0;
      const reg = toCents(n.prices.regular_price);
      // Lista solo si es realmente mayor: si no hay oferta, va en null.
      const lista = reg !== null && reg > price ? reg : null;

      // Categoría principal = la más cercana a la raíz, igual que `migrate:wp`.
      // Se resuelve por profundidad para no dejar el producto en "general".
      const cats = n.categories ?? [];
      let principal = cats[0];
      for (const c of cats) {
        if (!principal) {
          principal = c;
          continue;
        }
        const [dp, dc] = await Promise.all([depthOf(db, principal.slug), depthOf(db, c.slug)]);
        if (dc < dp) principal = c;
      }

      const inserted = await db
        .insert(products)
        .values({
          slug: n.slug.trim(),
          sku: (n.sku ?? "").trim(),
          name: n.name.replace(/<[^>]+>/g, "").trim().slice(0, 300) || n.slug.trim(),
          brand: n.brands?.[0]?.name?.trim() || "General",
          categorySlug: principal?.slug || "general",
          price,
          compareAtPrice: lista,
          stock: n.is_in_stock ? 1 : 0,
          images: n.images?.[0]?.src ? [n.images[0].src] : [],
          imageSrcSets: [],
          wpId: n.id,
        })
        .returning({ id: products.id, categorySlug: products.categorySlug });

      // Puente N:N: sin esto el producto existe pero no aparece en ninguna
      // categoría del árbol, que es donde lo busca el visitante.
      let puente = 0;
      for (const c of cats) {
        const cat = await db.execute<{ id: number }>(
          sql`SELECT id FROM categories WHERE slug = ${c.slug}`,
        );
        if (!cat.rows[0]) continue;
        await db
          .insert(productCategories)
          .values({ productId: inserted[0].id, categoryId: cat.rows[0].id })
          .onConflictDoNothing();
        puente += 1;
      }

      console.log(
        `  + ${n.slug}  (${money(price)})  categorías: ${
          cats.map((c) => c.slug).join(", ") || "ninguna"
        } → puente con ${puente}`,
      );
    }
  } else if (nuevos.length) {
    console.log(`[sync] ${nuevos.length} producto(s) nuevo(s) sin crear. Usá --add-missing para incorporarlos.`);
  }

  const check = await db.execute(sql`
    SELECT count(*)::int AS total, min(price)::bigint AS minimo, max(price)::bigint AS maximo
    FROM products`);
  console.log("[sync] estado final:", check.rows[0]);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[sync] falló:", error);
    process.exit(1);
  });
