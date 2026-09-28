/**
 * Auditoría del sitio desplegado: recorre rutas reales y reporta lo que una
 * revisión visual detectaría a simple vista.
 *
 * Comprueba: código HTTP, redirects, TTFB, H1 y meta description, imágenes
 * rotas, enlaces internos rotos y peso de página.
 *
 * Uso:
 *   npm run audit:site
 *   npm run audit:site -- --base=https://cordoba-digital.vercel.app --products=40
 */
import "dotenv/config";

const arg = (name: string, fallback: string) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1] : fallback;
};

const BASE = arg("base", "https://cordoba-digital.vercel.app").replace(/\/+$/, "");
const PRODUCT_SAMPLE = Number(arg("products", "30"));
const CATEGORY_SAMPLE = Number(arg("categories", "128"));
const CONCURRENCY = 6;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

type Route = { kind: string; url: string; bytes: number; ms: number; status: number; h1: string[]; desc: string | null; images: string[]; internal: string[]; error?: string };

async function fetchText(url: string): Promise<{ status: number; ms: number; text: string }> {
  const started = Date.now();
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,application/xml" } });
  const text = await res.text();
  return { status: res.status, ms: Date.now() - started, text };
}

const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

async function pool<T, R>(items: T[], worker: (item: T) => Promise<R>): Promise<R[]> {  const out: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      for (;;) {
        const i = cursor++;
        if (i >= items.length) return;
        out[i] = await worker(items[i]);
      }
    }),
  );
  return out;
}

function absolute(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function analyse(kind: string, url: string, status: number, ms: number, html: string): Route {
  const h1 = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => m[1].replace(/<[^>]*>/g, "").trim());
  const desc = html.match(/<meta name="description" content="([^"]*)"/i)?.[1] ?? null;
  const images = [...html.matchAll(/<img[^>]+src="([^"]+)"/gi)].map((m) => absolute(m[1], url)).filter((s): s is string => Boolean(s));
  const internal = [...html.matchAll(/<a[^>]+href="([^"]+)"/gi)]
    .map((m) => absolute(m[1], url))
    .filter((s): s is string => Boolean(s) && new URL(s as string).host === new URL(BASE).host);
  return { kind, url, status, ms, bytes: Buffer.byteLength(html), h1, desc, images, internal };
}

async function main() {
  console.log(`[audit-site] base: ${BASE}`);

  // 1. Sitemap índice -> submaps -> rutas reales a revisar.
  const index = await fetchText(`${BASE}/sitemap.xml`);
  if (index.status !== 200) {
    console.error(`[audit-site] el sitemap no responde: ${index.status}`);
    process.exit(1);
  }
  const submapUrls = [...index.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  console.log(`[audit-site] submaps: ${submapUrls.length}`);

  // El sitemap declara el dominio canónico (www.cordobadigital.net), no el del
  // deploy: reescribimos el host para poder recorrerlo.
  const toBase = (u: string) => u.replace(/^https?:\/\/[^/]+/, BASE);
  const categoryUrls: string[] = [];
  const productUrls: string[] = [];
  for (const sm of submapUrls) {
    const xml = await fetchText(sm);
    for (const m of xml.text.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const loc = m[1];
      if (loc.includes("/categoria/")) categoryUrls.push(loc);
      else if (loc.includes("/producto/")) productUrls.push(loc);
    }
  }
  console.log(
    `[audit-site] sitemap: ${categoryUrls.length} categorías, ${productUrls.length} productos ` +
      `(host canónico: ${new URL(categoryUrls[0] ?? BASE).host})`,
  );

  // 2. Muestreo determinista (cada N) para no pegarle 2588 veces al deploy.
  const pick = <T>(arr: T[], n: number) =>
    n >= arr.length ? arr : Array.from({ length: n }, (_, i) => arr[Math.floor((i * arr.length) / n)]);
  const routes = [
    { kind: "home", url: `${BASE}/` },
    { kind: "productos", url: `${BASE}/productos` },
    { kind: "ayuda", url: `${BASE}/ayuda` },
    { kind: "carrito", url: `${BASE}/carrito` },
    { kind: "checkout", url: `${BASE}/checkout` },
    ...pick(categoryUrls, CATEGORY_SAMPLE).map((u) => ({ kind: "categoria", url: toBase(u) })),
    ...pick(productUrls, PRODUCT_SAMPLE).map((u) => ({ kind: "producto", url: toBase(u) })),
  ];

  console.log(`[audit-site] recorriendo ${routes.length} rutas…`);
  const results = await pool(routes, async (route) => {
    try {
      const { status, ms, text } = await fetchText(route.url);
      return analyse(route.kind, route.url, status, ms, text);
    } catch (error) {
      return { ...route, status: 0, ms: 0, bytes: 0, h1: [], desc: null, images: [], internal: [], error: (error as Error).message } as Route;
    }
  });

  // 3. Agregados por tipo.
  const byKind = new Map<string, Route[]>();
  for (const r of results) byKind.set(r.kind, [...(byKind.get(r.kind) ?? []), r]);

  console.log("\n─── Por tipo de página ───────────────────────────────");
  for (const [kind, list] of byKind) {
    const ok = list.filter((r) => r.status === 200);
    const times = ok.map((r) => r.ms).sort((a, b) => a - b);
    const bytes = ok.map((r) => r.bytes).sort((a, b) => a - b);
    const pct = (p: number) => (times.length ? times[Math.min(times.length - 1, Math.floor(times.length * p))] : 0);
    console.log(
      `${kind.padEnd(11)} ${ok.length}/${list.length} ok  ·  TTFB mediana ${pct(0.5)}ms p95 ${pct(0.95)}ms  ·  peso mediana ${kb(bytes[Math.floor(bytes.length / 2)] ?? 0)} max ${kb(bytes.at(-1) ?? 0)}`,
    );
  }

  const bad = results.filter((r) => r.status !== 200);
  const noH1 = results.filter((r) => r.status === 200 && r.h1.length === 0);
  const multiH1 = results.filter((r) => r.h1.length > 1);
  const noDesc = results.filter((r) => r.status === 200 && !r.desc);

  console.log("\n─── Hallazgos ───────────────────────────────────────");
  console.log(`Status != 200: ${bad.length}`);
  for (const r of bad.slice(0, 10)) console.log(`  ${r.status || "ERR"} ${r.error ?? ""} ${r.url}`);
  console.log(`Sin <h1>: ${noH1.length}${noH1.length ? ` (ej. ${noH1[0].url})` : ""}`);
  console.log(`Con más de un <h1>: ${multiH1.length}${multiH1.length ? ` (ej. ${multiH1[0].url})` : ""}`);
  console.log(`Sin meta description: ${noDesc.length}${noDesc.length ? ` (ej. ${noDesc[0].url})` : ""}`);

  // 4. Imágenes: sample real contra el servidor viejo.
  const allImages = [...new Set(results.flatMap((r) => r.images))];
  console.log(`\nImágenes referenciadas: ${allImages.length} en ${results.length} páginas`);
  const imageSample = pick(allImages, 40);
  const imgResults = await pool(imageSample, async (src) => {
    try {
      const res = await fetch(src, { method: "HEAD", headers: { "user-agent": UA } });
      return { src, status: res.status, type: res.headers.get("content-type") ?? "", size: Number(res.headers.get("content-length") ?? 0) };
    } catch (error) {
      return { src, status: 0, type: "", size: 0, error: (error as Error).message };
    }
  });
  const brokenImages = imgResults.filter((r) => r.status === 0 || r.status >= 400);
  const heavy = imgResults.filter((r) => r.size > 600_000);
  console.log(`Imágenes rotas (muestra ${imageSample.length}): ${brokenImages.length}`);
  for (const b of brokenImages.slice(0, 8)) console.log(`  ${b.status} ${b.src}`);
  console.log(`Imágenes > 600 KB (muestra): ${heavy.length}${heavy.length ? ` · máx ${kb(heavy.at(-1)!.size)}` : ""}`);

  // 5. Enlaces internos rotos.
  const internalLinks = [...new Set(results.flatMap((r) => r.internal))].filter((u) => !u.includes("/carrito") && !u.includes("/checkout"));
  const linkSample = pick(internalLinks, 60);
  const linkResults = await pool(linkSample, async (u) => {
    try {
      const res = await fetch(u, { method: "HEAD", redirect: "follow", headers: { "user-agent": UA } });
      return { u, status: res.status };
    } catch {
      return { u, status: 0 };
    }
  });
  const brokenLinks = linkResults.filter((r) => r.status === 0 || r.status >= 400);
  console.log(`\nEnlaces internos rotos (muestra ${linkSample.length}): ${brokenLinks.length}`);
  for (const b of brokenLinks.slice(0, 10)) console.log(`  ${b.status} ${b.u}`);

  const problems =
    bad.length + noH1.length + multiH1.length + brokenImages.length + brokenLinks.length;
  console.log(`\n[audit-site] ${problems} problema(s) detectado(s).`);
  if (problems) process.exitCode = 2;
}

main().catch((error) => {
  console.error(`[audit-site] FATAL: ${(error as Error).message}`);
  process.exit(1);
});
