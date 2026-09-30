/**
 * Resuelve URLs de fotos del catálogo.
 *
 * WooCommerce sirve desde cordobadigital.net, pero Cloudflare (Bot Fight)
 * responde 403 al preview de Vercel y las cards quedan con el icono roto.
 * Hay un corpus local en /public/images/products: si el archivo existe,
 * usamos esa copia. Si no, devolvemos la URL original y ProductImg muestra
 * un placeholder al fallar.
 */

const LOCAL = new Set<string>([
  "1000x1000-drdji089-b.webp","17t-pro.jpg","82xq012gus-1.png","a27-5g.jpg",
  "adaptador-wi-fi-usb-nano-mercusys-mw150us-n150.webp","asus-tuf-16.webp",
  "auricular-jbl-tune-t730-bt-white-auricular-jbl-tune-t730-bt-white.jpg",
  "boombox-4.png","c201-1.jpg","chijkclifygimpqrp-c03c0lv1g.jpg",
  "d_nq_np_880459-mla93052304804_092025-o.png","deco-e4-pack-3.jpg",
  "dell-dc15250-2.png","disco-duro-externo-adata-4tb-slim-2048x1536.jpg",
  "dji-osmo-mobile-8p-creator-combo.webp","dron-dji-lito-1-fly-more-combo-rc-n3.jpg",
  "dron-dji-lito-x1-fly-more-combo-rc-n3-galeria.jpg","dron-dji-mavic-4-pro-512gb-creator-combo.png",
  "edge-70-fusion.webp","f1605va-ws74.jpg","g29.png","garmin-forerunner-55.jpg",
  "h8_set-cut-all-name_5.webp","insta360-x5-bundle-1.jpg","ipad-11-128gb.webp",
  "ipad-11-256gb.jpg","ipad-air-m4-11-128gb-2048x1628.png","ipad-air-m4-11-256gb-e1785933084341.jpg",
  "ipad-air-m4-13-128gb-e1785933017200.jpg","ipad-pro-m5-11-256gb-5g.webp",
  "ipad-pro-m5-11-512gb-5g-galeria.jpg","iphone-18-pro-max-celeste.jpg","iphone-18-pro-max.jpg",
  "iphone-18-pro.jpg","lito-rc2.webp","macbook-air-m5-13-16gb-1tb-silver.jpg",
  "macbook-air-m5-13-16gb-1tb-sky-blue.png","macbook-air-m5-13-16gb-1tb-starlight.png",
  "macbook-air-m5-15-16gb-1tb-midnight.png","macbook-air-m5-15-16gb-1tb-silver.png",
  "macbook-air-m5-15-16gb-1tb-sky-blue.png","macbook-air-m5-15-16gb-1tb-starlight.png",
  "macbook-air-m5-15-16gb-512gb-midnight-1.png","macbook-air-m5-15-16gb-512gb-midnight.jpg",
  "macbook-air-m5-15-16gb-512gb-silver-1.jpg","macbook-air-m5-15-16gb-512gb-silver.jpg",
  "macbook-air-m5-15-16gb-512gb-sky-blue-1.png","macbook-air-m5-15-16gb-512gb-sky-blue.png",
  "macbook-pro-m5-14-16gb-1tb-silver.png","macbook-pro-m5-14-16gb-1tb-space.jpg",
  "macbook-pro-m5-14-24gb-1tb-silver.jpg","macbook-pro-m5-16-24gb-1tb-silver.jpg",
  "macbook-pro-m5-16-24gb-1tb-space.png","macbook-pro-m5-16-48gb-1tb-silver.png",
  "macbook-pro-m5-16-48gb-1tb-space.png","macbook-pro-m5-pro-14-24gb-1tb-space.png",
  "macbook-pro-m5-pro-14e280b3-24gb-1tb-silver.png","macbook-pro-m5-pro-14e280b3-24gb-2tb-silver.png",
  "macbook-pro-m5-pro-14e280b3-24gb-2tb-space.png","macbook-pro-m5-pro-max-16-36gb-2tb-silver.jpg",
  "meta-quest-3s.webp","micro-sd-128gb-hiksemi-clase-10-c1.webp","mini-5-pro.jpg",
  "monopatin-electrico-daihatsu-v100.webp","monopatin-electrico-daihatsu-v101.webp",
  "monopatin-electrico-daihatsu-v200.jpg","monopatin-electrico-daihatsu-v201.webp",
  "monopatin-electrico-daihatsu-v300-2048x2048.jpg","monopatin-electrico-daihatsu-v301-2048x2048.jpg",
  "monopatin-electrico-daihatsu-v400.webp","monopatin-electrico-daihatsu-v401.jpg",
  "monopatin-xiaomi-electric-scooter-6-pro.webp","moto-g15-n.png","moto-g86-8gb-512gb.webp",
  "motorola-moto-g06-128gb-4gb.jpg","motorola-moto-g06-64gb-4gb.png",
  "motorola-moto-g57-power-5g-256gb-8gb.webp","motorola-moto-g96.webp",
  "motorola-moto-signature-5g-1tb-16gb.jpg","nikon-z6-iii-kit-2048x2048.webp",
  "notebook-dell-inspiron-15-i5-1334u-8gb-ssd-512gb-156-fhd-win-11.jpg",
  "notebook-dell-inspiron-15-ryzen-3-7320u-8gb-ssd-512gb-156-fhd-w11.jpg",
  "notebook-hp-14-i5-120u-16gb-ssd-1tb-14-fhd-w11.webp",
  "notebook-hp-15-i5-1334u-8gb-ssd-256gb-156-hd-w11.webp",
  "notebook-hp-i7-150u-16gb-ssd-512gb-156-fhd-touchscreen-w11.webp",
  "panasonic-hc-v900-hd.png","panasonic-hc-vx3-uhd-4k.png",
  "pendrive-hiksemi-64gb-usb-2-0-galeria.jpg","realme-c71.webp","realme-c75x-e1784429789464.webp",
  "realme-c85.webp","realme-note-70.webp","redmi-note-14-5g.webp","redmi-note-17-1.webp",
  "redmi-note-17-5g.png","s26-fe.png","scooter-6-ultra.webp","sony-playstation-5-pro-2tb.webp",
  "tablet-xiaomi-redmi-pad-2-128gb-4gb-11.webp","tapo-c246d2.png","xiaomi-17t-5g-512gb-12gb.png",
  "xiaomi-17t-pro-5g-1tb-12gb.png","xiaomi-17t-pro-negro.png","xiaomi-17t.webp","xiaomi-5-plus.webp",
  "xiaomi-poco-f9-ultra-5g-256gb-12gb-galeria.jpg","xiaomi-poco-f9-ultra-5g-256gb-12gb.png",
  "xiaomi-redmi-17.jpg","xiaomi-redmi-note-17-pro-5g-256gb-8gb.png",
  "xiaomi-redmi-note-17-pro-max-5g-256gb-8gb.png","xiaomi-redmi-note-17-pro-max-5g-512gb-8gb.png",
  "xtreme-4.webp","z-fold-8-ultra.webp","z8-flip.jpg",
]);

const SIZE_SUFFIX = /-\d{2,4}x\d{2,4}(?=\.[a-z0-9]+$)/i;

function basename(url: string): string {
  try {
    const path = url.startsWith("http") ? new URL(url).pathname : url.split("?")[0];
    return decodeURIComponent(path.split("/").pop() ?? "");
  } catch {
    return "";
  }
}

function candidates(file: string): string[] {
  const raw = file.trim();
  if (!raw) return [];
  const lower = raw.toLowerCase();
  const stripped = lower.replace(SIZE_SUFFIX, "");
  return [...new Set([raw, lower, stripped, stripped.replace(/-galeria$/, "")])];
}

export function resolveMedia(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("/images/")) return url;
  const file = basename(url);
  for (const name of candidates(file)) {
    if (LOCAL.has(name)) return `/images/products/${name}`;
  }
  return url;
}

export function resolveSrcSet(entries: string[] | undefined): string[] {
  if (!entries?.length) return [];
  return entries.map((entry) => {
    const parts = entry.trim().split(/\s+/);
    const rewritten = resolveMedia(parts[0]);
    return parts.length > 1 ? `${rewritten} ${parts.slice(1).join(" ")}` : rewritten;
  });
}

export function hasLocalMedia(url: string | null | undefined): boolean {
  if (!url) return false;
  return resolveMedia(url).startsWith("/images/");
}
