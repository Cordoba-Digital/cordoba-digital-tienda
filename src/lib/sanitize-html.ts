/**
 * Saneo de HTML sin dependencias externas: allowlist estricta de tags y
 * atributos, y borrado de bloques peligrosos. Lo usan la migración de
 * WooCommerce y la edición de descripciones desde el admin.
 */
const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "ul",
  "ol",
  "li",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "a",
  "img",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "blockquote",
  "span",
]);

/** Únicos atributos permitidos por tag (esto ya descarta `on*` y `style`). */
const ALLOWED_ATTRS: Record<string, readonly string[]> = {
  a: ["href"],
  img: ["src", "alt"],
};

const VOID_TAGS = new Set(["br", "img"]);
/** Tags dangerousos: se borran con todo su contenido. */
const DROP_WITH_CONTENT = new Set(["script", "style", "iframe", "noscript", "object", "embed", "form", "svg", "math"]);

const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>])*?)(\/?)>/g;
const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
const UNSAFE_URL_RE = /^\s*(?:javascript|vbscript|data)\s*:/i;

/** `&#8211;` / `&#8217;` yimilar → carácter (solo códigos no ASCII, para no romper el HTML). */
function decodeEntities(input: string): string {
  return input.replace(/&#x([0-9a-f]{2,6});|&#[0-9]{3,7};/gi, (raw) => {
    const hex = /^&#x/i.test(raw);
    const code = Number.parseInt(raw.replace(/&#x?|&;|#/gi, ""), hex ? 16 : 10);
    if (!Number.isFinite(code) || code < 160 || code > 0x10ffff) return raw;
    try {
      return String.fromCodePoint(code);
    } catch {
      return raw;
    }
  });
}

function escapeAttrValue(value: string): string {
  return value.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function cleanAttrs(tag: string, raw: string): string {
  const allowed = ALLOWED_ATTRS[tag];
  if (!allowed) return "";
  const kept: string[] = [];
  for (const m of raw.matchAll(ATTR_RE)) {
    const name = m[1].toLowerCase();
    if (!allowed.includes(name)) continue; // descarta on*, style, class, id, data-*
    const value = m[2] ?? m[3] ?? m[4] ?? "";
    if (UNSAFE_URL_RE.test(value)) continue;
    kept.push(`${name}="${escapeAttrValue(value)}"`);
  }
  return kept.length ? ` ${kept.join(" ")}` : "";
}

/** Allowlist estricta de tags/atributos + borrado de bloques peligrosos. */
export function sanitizeHtml(html?: string | null): string {
  if (!html) return "";
  let out = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");
  for (const tag of DROP_WITH_CONTENT) {
    out = out
      .replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, "gi"), "")
      .replace(new RegExp(`<\\/${tag}\\s*>`, "gi"), "")
      .replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, "gi"), "");
  }
  out = out.replace(TAG_RE, (match, closing: string, rawTag: string, rawAttrs: string, selfClose: string) => {
    const tag = rawTag.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return ""; // unwrap: se conserva el texto interno
    if (closing) return VOID_TAGS.has(tag) ? "" : `</${tag}>`;
    const attrs = cleanAttrs(tag, rawAttrs ?? "");
    return VOID_TAGS.has(tag) || selfClose ? `<${tag}${attrs} />` : `<${tag}${attrs}>`;
  });
  return decodeEntities(out)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
