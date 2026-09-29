/**
 * Checker de soft-404: comprueba que las rutas parametrizadas responden 404 de
 * verdad cuando el recurso no existe.
 *
 * El bug que vigila: `/producto/[slug]` renderizaba la pagina de not-found con
 * status 200 y title "Producto no encontrado". Google lo registra como una URL
 * valida mas y la diluye en el indice; en un catalogo de 2.588 productos eso es
 * justo el tipo de detalle que no se puede dejar si el SEO es argumento de
 * venta.
 *
 * Cada corrida incluye un CONTROL: un slug que sí existe y tiene que responder
 * 200. Si el control tambien da 404 el checker esta roto (base equivocada,
 * catalogo vacio, deploy caido), no el sitio, asi que el script lo dice antes
 * de culpar a nadie.
 *
 * Ademas recorre `/sitemap.xml` y sus submapas y pide cada URL listada, para
 * verificar que el sitemap no anuncia paginas que devuelven 404.
 *
 * Uso:
 *   npx tsx scripts/check-soft404.ts --base=http://localhost:3102
 *   npm run check:soft404 -- --base=https://cordoba-digital.vercel.app
 *   npx tsx scripts/check-soft404.ts --base=... --slugs=5 --sitemap-products=all
 *   npx tsx scripts/check-soft404.ts --base=... --expected-products=2588
 */

// Sin imports ni exports estos archivos son scripts globales y `BASE`, `UA` y
// los helpers chocan con los de `check-gallery.ts` en el `tsc --noEmit`. El
// `export {}` los vuelve modulos y cada uno con su propio scope.
export {};

const arg = (name: string, fallback: string) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1] : fallback;
};

const BASE = arg("base", "https://cordoba-digital.vercel.app").replace(/\/+$/, "");
/** Cuantos slugs inexistentes se prueban en `/producto/[slug]`. */
const FAKE_SLUGS = Number(arg("slugs", "5"));
/** Muestra de productos del sitemap que se piden por HTTP. `all` = todos. */
const SITEMAP_PRODUCTS = arg("sitemap-products", "40");
/** Tope de categorias/estaticas del sitemap que se piden por HTTP. */
const SITEMAP_CATEGORIES = Number(arg("sitemap-categories", "500"));
/**
 * Cantos productos deberia listar el sitemap. 0 = no chequea el total.
 *
 * El status HTTP no alcanza como guarda: si un submapa se come la fila que
 * otro repite, todas las URLs listadas siguen respondiendo 200 y el catalogo
 * pierde productos en silencio. El conteo si lo delata.
 */
const EXPECTED_PRODUCTS = Number(arg("expected-products", "0"));
const CONCURRENCY = 8;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Titulos de una pagina de error. Si un 404 no dice nada de esto, la pagina
 *  esta reutilizando el chrome del sitio y no se distingue de una ficha real. */
const NOT_FOUND_TITLE = /no encontr|not found|404|página no encontrada/i;

type Probe = {
  kind: string;
  path: string;
  status: number;
  title: string | null;
  ok: boolean;
  note?: string;
};

const failures: string[] = [];
const warnings: string[] = [];

function fail(message: string) {
  failures.push(message);
  console.log(`  FALLA  ${message}`);
}
function warn(message: string) {
  warnings.push(message);
  console.log(`  AVISO  ${message}`);
}
function pass(message: string) {
  console.log(`  ok     ${message}`);
}

/** Slugs que no existen de verdad: aleatorios, asi no colisionan con el catalogo. */
function fakeSlug(i: number): string {
  const token = Math.random().toString(36).slice(2, 10) + i;
  const shapes = [
    `producto-inexistente-${token}`,
    `no-existe-${token}`,
    `${token}`,
    `zzz-slug-que-no-esta-${token}`,
    `__sin-producto-${token}`,
  ];
  return shapes[i % shapes.length];
}

function titleOf(html: string): string | null {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (!m) return null;
  return decodeEntities(m[1].trim()).slice(0, 80);
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(Number(d)));
}

/** Convierte una URL del sitemap (host de produccion) a la base que se teste. */
function localize(url: string): string {
  try {
    const u = new URL(url);
    return `${BASE}${u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

async function probe(kind: string, path: string, expected: number): Promise<Probe> {
  let status = 0;
  let title: string | null = null;
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "user-agent": UA, accept: "text/html,application/xml" },
      redirect: "manual",
    });
    status = res.status;
    const type = res.headers.get("content-type") ?? "";
    if (type.includes("html")) title = titleOf(await res.text());
    else await res.arrayBuffer();
  } catch (error) {
    status = 0;
    title = null;
    return { kind, path, status, title, ok: false, note: (error as Error).message };
  }
  const ok = status === expected;
  return { kind, path, status, title, ok };
}

async function pool<T, R>(items: T[], worker: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (cursor < items.length) {
        const i = cursor++;
        out[i] = await worker(items[i]);
      }
    }),
  );
  return out;
}

function line(p: Probe, expected: number): string {
  const mark = p.ok ? "ok   " : "FALLA";
  const title = p.title ? `  "${p.title}"` : "";
  return `  ${mark} ${String(p.status).padEnd(4)} (esperaba ${expected})  ${p.path}${title}${p.note ? `  [${p.note}]` : ""}`;
}

/** URLs de un XML de sitemap. */
function locs(xml: string): string[] {
  return [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/g)].map((m) => decodeEntities(m[1].trim()));
}

async function main() {
  console.log(`\nsoft-404 check contra ${BASE}\n`);

  // ---------------------------------------------------------------- control
  // El control sale del sitemap: si el sitio publica productos, ahi esta el
  // catalogo real y el control no depende de un slug clavado en el script.
  console.log("[1] CONTROL: el checker distingue 404 de 200?");
  const indexRes = await fetch(`${BASE}/sitemap.xml`, {
    headers: { "user-agent": UA, accept: "application/xml" },
  });
  if (!indexRes.ok) {
    fail(`no se pudo leer /sitemap.xml (status ${indexRes.status}): el checker no tiene con que armarse.`);
    return finish();
  }
  const submaps = locs(await indexRes.text()).map(localize);
  if (!submaps.length) {
    fail("/sitemap.xml no listo ningun submapa.");
    return finish();
  }

  const firstMapRes = await fetch(submaps[0], { headers: { "user-agent": UA } });
  if (!firstMapRes.ok) {
    fail(`el primer submapa del indice responde ${firstMapRes.status} (esta listado en /sitemap.xml).`);
    return finish();
  }
  const firstMapXml = await firstMapRes.text();
  const productUrls = locs(firstMapXml).filter((u) => /\/producto\/[^/]+$/.test(u));
  const control = productUrls[0];
  if (!control) {
    fail("ningun submapa lista un producto: no hay forma de armar el control.");
    return finish();
  }
  const controlProbe = await probe("control", new URL(control).pathname, 200);
  console.log(line(controlProbe, 200));
  if (!controlProbe.ok) {
    fail(
      `el control ${controlProbe.path} responde ${controlProbe.status} y deberia ser 200. ` +
        `El checker esta mal (base equivocada o deploy caido), no el sitio: no se atribuyan las 404 de abajo al SEO.`,
    );
    return finish();
  }
  pass("el control responde 200, el checker mide bien.");

  // ------------------------------------------------------- producto/[slug]
  console.log(`\n[2] /producto/[slug] con slugs inexistentes (esperan 404)`);
  const fakeProbes = await pool(
    Array.from({ length: FAKE_SLUGS }, (_, i) => fakeSlug(i)),
    (slug) => probe("producto", `/producto/${encodeURIComponent(slug)}`, 404),
  );
  for (const p of fakeProbes) {
    console.log(line(p, 404));
    if (!p.ok) {
      fail(
        `/producto/${p.path.replace("/producto/", "")} responde ${p.status}: ` +
          (p.status === 200
            ? "soft-404. Google la indexa como valida."
            : `esperaba 404 (control ya dio 200, asi que el checker anda bien).`),
      );
    } else if (p.title && !NOT_FOUND_TITLE.test(p.title)) {
      warn(`404 con title "${p.title}", que no parece el de la pagina de not-found real.`);
    }
  }

  // El control tambien con el criterio de la seccion 2, por simetria.
  console.log(line(controlProbe, 200));

  // ------------------------------------------------- resto de rutas /[param]
  console.log("\n[3] las demas rutas parametrizadas (esperan 404)");
  const token = Math.random().toString(36).slice(2, 10);
  const otherRoutes: { path: string; expected: number }[] = [
    { path: `/categoria/no-existe-${token}/subcategoria`, expected: 404 },
    { path: `/categoria/${token}`, expected: 404 },
    { path: `/pedido/CD-${token.toUpperCase()}`, expected: 404 },
    { path: "/sitemap-9999.xml", expected: 404 },
    { path: "/sitemap/no-es-un-id", expected: 404 },
  ];
  for (const route of otherRoutes) {
    const p = await probe("otra", route.path, route.expected);
    console.log(line(p, route.expected));
    if (!p.ok) {
      fail(
        `${p.path} responde ${p.status} y esperaba ${route.expected}` +
          (p.status === 200 ? " (soft-404)" : ""),
      );
    }
  }

  // ------------------------------------------------------------ sitemap
  console.log(`\n[4] coherencia del sitemap (ninguna URL listada puede dar 404)`);
  const allMapXml: string[] = [];
  const mapProbes = await pool(submaps, async (url) => {
    const res = await fetch(url, { headers: { "user-agent": UA } });
    const xml = res.ok ? await res.text() : "";
    return { url, status: res.status, xml };
  });
  for (const p of mapProbes) {
    if (p.status !== 200) fail(`submapa del indice ${p.url} responde ${p.status}.`);
    else allMapXml.push(p.xml);
  }

  const everyUrl = allMapXml.flatMap(locs);
  const productEmitted = everyUrl.filter((u) => /\/producto\/[^/]+$/.test(u));
  const productLoc = [...new Set(productEmitted)];
  const otherLoc = [...new Set(everyUrl.filter((u) => !/\/producto\/[^/]+$/.test(u)))];
  console.log(
    `  submapas: ${submaps.length} · URLs unicas listadas: ${productLoc.length + otherLoc.length} · productos: ${productLoc.length} · resto: ${otherLoc.length}`,
  );
  // El conteo completo es la regresion: `listProducts` ordenaba por
  // featured+soldCount, que no es un orden total, y el OFFSET se pisaba entre
  // submapas. El sitio entregaba 2580 URLs de 2588 productos: 8 nunca llegaban
  // a Google y 8 iban repetidas, y nada en el sitio lo delataba porque todas
  // las que=listadas respondian 200. Falta una y sobra otra con el mismo
  // estado, asi que el status solo no alcanza: hay que mirar el conteo.
  console.log(`  productos emitidos en los submapas: ${productEmitted.length}`);
  if (productEmitted.length !== productLoc.length) {
    fail(
      `los submapas emiten ${productEmitted.length} URLs de producto pero solo ${productLoc.length} son ` +
        `distintas: la paginacion se pisa entre submapas (ORDER BY sin desempate). ` +
        `Faltan URLs y otras van repetidas, y las dos cosas se esconden detras de un 200.`,
    );
  } else {
    pass(`sin duplicados: ${productLoc.length} URLs de producto, todas distintas.`);
  }
  if (EXPECTED_PRODUCTS > 0) {
    if (productLoc.length === EXPECTED_PRODUCTS) {
      pass(`el sitemap lista los ${EXPECTED_PRODUCTS} productos esperados.`);
    } else {
      fail(
        `el sitemap lista ${productLoc.length} productos y se esperaban ${EXPECTED_PRODUCTS}. ` +
          `Si el catalogo cambio de verdad, actualiza el --expected-products del comando.`,
      );
    }
  }

  const checkUrls = async (urls: string[], label: string) => {
    if (!urls.length) return;
    const results = await pool(urls, (u) => probe("sitemap", new URL(u).pathname, 200));
    const bad = results.filter((r) => !r.ok);
    for (const b of bad.slice(0, 10)) {
      fail(`el sitemap lista ${b.path} pero responde ${b.status}.`);
    }
    if (bad.length > 10) fail(`... y ${bad.length - 10} URLs mas del sitemap con status != 200.`);
    if (!bad.length) pass(`${label}: ${urls.length} URLs responden 200.`);
  };

  const categoriesToCheck = otherLoc.slice(0, SITEMAP_CATEGORIES);
  if (categoriesToCheck.length < otherLoc.length) {
    console.log(
      `  nota   se revisan ${categoriesToCheck.length} de ${otherLoc.length} URLs no-producto; subilo con --sitemap-categories=${otherLoc.length}`,
    );
  }
  await checkUrls(categoriesToCheck, "categorias + estaticas");

  if (SITEMAP_PRODUCTS === "all") {
    await checkUrls(productLoc, "productos (todos)");
  } else {
    const sampleSize = Math.min(Number(SITEMAP_PRODUCTS), productLoc.length);
    // Muestra repartida: los submapas se llenan con offset, asi que los
    // ultimos productos son los que nadie revisa a ojo.
    const step = Math.max(1, Math.floor(productLoc.length / sampleSize));
    const sample = productLoc.filter((_, i) => i % step === 0).slice(0, sampleSize);
    await checkUrls(sample, `productos (muestra de ${sample.length} de ${productLoc.length})`);
    if (sampleSize < productLoc.length) {
      console.log("  nota   para la auditoria completa: --sitemap-products=all");
    }
  }

  finish();
}

function finish() {
  console.log("");
  if (warnings.length) console.log(`AVISOS: ${warnings.length}`);
  if (failures.length) {
    console.log(`FALLAS: ${failures.length}`);
    process.exit(1);
  }
  console.log("Todo en orden: las rutas inexistentes devuelven 404 de verdad y el sitemap no lista URLs muertas.");
}

main().catch((error) => {
  console.error("el checker fallo:", error);
  process.exit(1);
});
