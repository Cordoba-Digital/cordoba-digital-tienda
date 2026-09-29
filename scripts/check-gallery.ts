/**
 * Verifica en el sitio desplegado que las miniaturas de la galería muestran
 * fotos distintas.
 *
 * El bug que vigila: `image_srcset` era un array plano con las variantes de
 * todas las fotos mezcladas, y la galería lo pasaba a cada miniatura. El
 * navegador elegía por ancho una variante que podía ser de otra foto, así que
 * todas las miniaturas acababan mostrando la misma imagen.
 *
 * No alcanza con contar imágenes: hay que comprobar que cada miniatura **solo**
 * puede cargar la foto de su índice, que es justamente lo que fallaba.
 *
 * Uso:
 *   npm run check:gallery                     # contra el deploy
 *   npm run check:gallery -- --base=http://localhost:3000
 */
const argv = process.argv.slice(2);
const baseArg = argv.find((a) => a.startsWith("--base="));
const BASE = (baseArg ? baseArg.split("=")[1] : "https://cordoba-digital.vercel.app").replace(/\/+$/, "");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/**
 * Slugs reales del catálogo, todos con 2 o más fotos en WooCommerce.
 *
 * Un producto con una sola foto no es un bug: 441 de los 2.588 tienen una, y en
 * WooCommerce también. El checker exige 2 miniaturas distintas justamente para
 * detectar el srcset mezclado, así que solo tiene sentido con productos que
 * traen varias fotos.
 */
const SLUGS = [
  "macbook-neo-13-8gb-256gb-silver",
  "pc-gamer-amd-ryzen-7-5700g-am4-8gb-ddr4-ssd-240gb-w10",
  "iphone-18-pro-max-512gb",
  "aire-acondicionado-bgh-3300w-frio-calo-bse35wcau",
  "aspiradora-robot-ultracomb-as-6061",
];

/** Quita el sufijo de tamaño que WooCommerce agrega (`foto-800x800.jpg`). */
const baseOf = (url: string): string => url.replace(/-\d+x\d+(?=\.[a-z0-9]+$)/i, "");

type Img = { src: string; srcset: string };

function parseGallery(html: string): Img[] {
  // Solo las <img> de la galería. Se las reconoce por su `sizes`: las
  // miniaturas declaran `sizes="96px"` y la principal termina en `700px`
  // (`"(max-width: 1024px) 100vw, 700px"`). Las tarjetas de productos
  // relacionados usan `sizes` con `50vw`/`25vw`, así que quedan fuera.
  const imgs: Img[] = [];
  const re = /<img\b[^>]*>/g;
  for (const match of html.matchAll(re)) {
    const tag = match[0];
    const sizes = /sizes="([^"]*)"/.exec(tag)?.[1];
    const esMiniatura = sizes === "96px";
    const esPrincipal = Boolean(sizes) && /,\s*700px$/.test(sizes as string);
    if (!esMiniatura && !esPrincipal) continue;
    const src = /src="([^"]*)"/.exec(tag)?.[1];
    if (!src || !src.includes("/wp-content/uploads/")) continue;
    const raw = /srcset="([^"]*)"/.exec(tag)?.[1];
    imgs.push({ src: decodeEntities(src), srcset: raw ? decodeEntities(raw) : "" });
  }
  return imgs;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function check(slug: string): Promise<{ ok: boolean; detail: string }> {
  const res = await fetch(`${BASE}/producto/${slug}`, { headers: { "user-agent": UA } });
  if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
  const html = await res.text();
  const imgs = parseGallery(html);
  if (!imgs.length) return { ok: false, detail: "no se encontró ninguna imagen" };

  // La foto principal es la última: va después de las miniaturas en el HTML.
  const thumbs = imgs.slice(0, -1);
  const main = imgs[imgs.length - 1];

  const fotos = new Set(thumbs.map((t) => baseOf(t.src)));
  if (fotos.size < 2) {
    return { ok: false, detail: `solo ${fotos.size} foto(s) distinta(s) en ${thumbs.length} miniaturas` };
  }

  // Ninguna miniatura puede cargar una variante de otra foto.
  for (const [i, thumb] of thumbs.entries()) {
    const own = baseOf(thumb.src);
    for (const entry of thumb.srcset.split(",").map((e) => e.trim()).filter(Boolean)) {
      const url = decodeEntities(entry.split(/\s+/)[0]);
      if (!url) continue;
      if (baseOf(url) !== own) {
        return { ok: false, detail: `miniatura ${i} puede cargar otra foto: ${url.split("/").pop()}` };
      }
    }
  }

  // Y la principal tiene que ser una de las de la galería.
  const mainFalta = main.srcset && !main.srcset.split(",").some((e) => baseOf(decodeEntities(e.split(/\s+/)[0])) === baseOf(main.src));
  if (mainFalta) return { ok: false, detail: "el srcset de la foto principal no incluye su propia imagen" };

  return { ok: true, detail: `${thumbs.length} miniaturas, ${fotos.size} fotos distintas, sin fugas` };
}

async function main() {
  console.log(`[gallery] ${BASE}\n`);
  let fallos = 0;

  for (const slug of SLUGS) {
    try {
      const { ok, detail } = await check(slug);
      if (!ok) fallos += 1;
      console.log(`  ${ok ? "OK  " : "FALLA"} ${slug}\n         ${detail}`);
    } catch (error) {
      fallos += 1;
      console.log(`  ERROR ${slug}: ${(error as Error).message}`);
    }
  }

  console.log(`\n[gallery] ${SLUGS.length - fallos}/${SLUGS.length} productos correctos`);
  process.exit(fallos ? 1 : 0);
}

main();
