/**
 * Convierte el HTML que viene de WordPress en HTML seguro para la tienda.
 *
 * Por qué hay que hacerlo: el contenido de los artículos se guarda en la base y
 * se pinta con `dangerouslySetInnerHTML`. WordPress devuelve HTML crudo y los
 * artículos tienen un problema real: cada uno lleva metido un documento HTML
 * completo adentro del campo de contenido, con su `<html>`, `<head>`, su
 * `<style>` y su `<meta charset>`. Si eso se pinta tal cual, el CSS del artículo
 * se aplica a toda la página y rompe el diseño de la tienda.
 *
 * La regla es lista blanca, no lista negra: se permite un conjunto cerrado de
 * etiquetas y se descarta todo lo demás, incluidos TODOS los atributos salvo
 * `href` de `<a>`. Así ni un `onclick`, ni un `style`, ni un `<script>` pueden
 * llegar al navegador aunque el contenido de origen cambie.
 */

/** Etiquetas que se conservan. Cualquier otra se borra, pero su texto no. */
const PERMITIDAS = new Set([
  "h2", "h3", "h4",
  "p", "br",
  "strong", "b", "em", "i", "u",
  "ul", "ol", "li",
  "table", "thead", "tbody", "tr", "th", "td",
  "code", "blockquote", "hr", "a",
]);

/** Etiquetas que se borran con todo su contenido. */
const DESCARTAR_CON_CONTENIDO = new Set([
  "script", "style", "iframe", "noscript", "template",
  "svg", "math", "object", "embed",
  "head", "meta", "link", "base", "title",
]);

/** Etiquetas que se desenvuelven: su contenido pasa al artículo. */
const DESENVOLVER = new Set(["html", "body"]);

const ENTIDADES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'",
  "&nbsp;": " ", "&hellip;": "…", "&mdash;": "—", "&ndash;": "–",
  "&laquo;": "«", "&raquo;": "»", "&ldquo;": "“", "&rdquo;": "”",
  "&lsquo;": "‘", "&rsquo;": "’", "&deg;": "°", "&times;": "×",
  "&copy;": "©", "&reg;": "®", "&trade;": "™", "&euro;": "€",
  "&eacute;": "é", "&aacute;": "á", "&iacute;": "í", "&oacute;": "ó",
  "&uacute;": "ú", "&ntilde;": "ñ", "&uuml;": "ü", "&Aacute;": "Á",
  "&Eacute;": "É", "&Iacute;": "Í", "&Oacute;": "Ó", "&Uacute;": "Ú",
  "&Ntilde;": "Ñ", "&sup2;": "²", "&sup3;": "³",
};

/** Escapa texto para que no pueda cerrar una etiqueta ni abrir un atributo. */
function escaparTexto(valor: string): string {
  return valor
    .replace(/&(?!(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);)/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function decodificarEntidades(valor: string): string {
  return valor
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&[a-zA-Z]+;/g, (ent) => ENTIDADES[ent] ?? ent);
}

/** Texto plano de un fragmento: sin etiquetas, entidades resueltas, espacios normalizados. */
export function aTextoPlano(html: string): string {
  return decodificarEntidades(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Traduce los enlaces de WooCommerce a las rutas de la tienda.
 *
 * `/categoria-producto/computacion/notebooks-cordoba/` pasa a
 * `/categoria/computacion/notebooks-cordoba`. Sin esto cada artículo mandaría al
 * visitante al sitio viejo y la tienda nueva perdería la venta.
 */
export function reescribirEnlaces(html: string): string {
  return html.replace(/href="([^"]*)"/g, (_todo, href: string) => {
    let destino = href;

    if (/^https?:\/\//i.test(destino)) {
      try {
        const url = new URL(destino);
        destino = url.pathname + url.search;
      } catch {
        return 'href="#"';
      }
    }

    destino = destino
      .replace(/^\/categoria-producto\//i, "/categoria/")
      .replace(/^https?:\/\/(?:www\.)?cordobadigital\.net/i, "");

    // Solo enlaces internos que existen en la tienda. Fuera o absoluto: roto.
    if (!destino.startsWith("/") || destino.startsWith("//")) return 'href="#"';
    if (/^\/wp-/.test(destino)) return 'href="#"';

    // Sin barra final: es la forma que usan las rutas del sitio.
    destino = destino.replace(/\/+$/, "") || "/";

    return `href="${escaparTexto(destino)}"`;
  });
}

/**
 * Reescribe también las URLs que están como texto, no como enlace.
 *
 * El pie de cada artículo tiene una línea "Publicado originalmente para la
 * sección: https://www.cordobadigital.net/categoria-producto/impresoras-cordoba/"
 * escrita en texto pelado. `reescribirEnlaces` no la ve porque no es un `href`,
 * y si queda así el artículo muestra la dirección del sitio viejo.
 */
export function reescribirUrlsSueltas(html: string): string {
  return html
    .replace(
      /https?:\/\/(?:www\.)?cordobadigital\.net\/categoria-producto\/([^/\s"'<>]+(?:\/[^/\s"'<>]+)*)\/?/gi,
      (_todo, camino: string) => `/categoria/${camino.replace(/\/+$/, "")}`,
    )
    .replace(/https?:\/\/(?:www\.)?cordobadigital\.net\/?/gi, "");
}

/**
 * Sanea el HTML de un artículo y devuelve solo lo que se puede pintar.
 *
 * @param html contenido crudo de la API de WordPress
 * @returns HTML con una lista blanca de etiquetas y sin atributos
 */
export function sanearGuia(html: string): string {
  const salida: string[] = [];

  type Modo = "emitir" | "envolver" | "descartar";
  const pila: { tag: string; modo: Modo }[] = [];

  /** Profundidad de etiquetas cuyo contenido se tira entero (script, style...). */
  let descartando = 0;

  const cerrarHasta = (indice: number) => {
    for (let i = pila.length - 1; i >= indice; i -= 1) {
      const marco = pila[i];
      if (marco.modo === "emitir") salida.push(`</${marco.tag}>`);
      if (marco.modo === "descartar") descartando -= 1;
    }
    pila.length = indice;
  };

  const patron =
    /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<!DOCTYPE[^>]*>|<\/([a-zA-Z][a-zA-Z0-9]*)\s*>|<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g;

  let ultimo = 0;
  for (const m of html.matchAll(patron)) {
    // El texto entre marcas se escapa SIEMPRE: es la única barrera contra un
    // `<script>` escrito sin escapar los angulos. Y si estamos adentro de un
    // <style> o un <script>, se tira entero: si no, el CSS del artículo queda
    // como texto visible, y el JavaScript también.
    if (descartando === 0) salida.push(escaparTexto(html.slice(ultimo, m.index)));
    ultimo = m.index + m[0].length;

    if (m[0].startsWith("<!--") || m[0].startsWith("<![CDATA[") || m[0].startsWith("<!DOCTYPE")) continue;

    if (m[1]) {
      const nombre = m[1].toLowerCase();
      for (let i = pila.length - 1; i >= 0; i -= 1) {
        if (pila[i].tag === nombre) {
          cerrarHasta(i);
          break;
        }
      }
      // Un cierre sin apertura se ignora: no inventa jerarquía.
      continue;
    }

    if (!m[2]) continue;
    const tag = m[2].toLowerCase();
    const atributos = m[3] ?? "";

    if (DESCARTAR_CON_CONTENIDO.has(tag)) {
      pila.push({ tag, modo: "descartar" });
      descartando += 1;
      continue;
    }
    if (DESENVOLVER.has(tag) || !PERMITIDAS.has(tag)) {
      // Se borra la etiqueta pero el texto de adentro se conserva: así no se
      // pierde contenido que estaba dentro de un <div> o un <span>.
      pila.push({ tag, modo: "envolver" });
      continue;
    }

    if (tag === "br" || tag === "hr") {
      salida.push(`<${tag} />`);
      continue;
    }

    if (tag === "a") {
      const href = /href\s*=\s*"([^"]*)"/i.exec(atributos)?.[1] ?? "";
      if (href && !/^\s*javascript:/i.test(href) && !/^\s*data:/i.test(href)) {
        salida.push(`<a href="${escaparTexto(href)}" rel="noopener">`);
      } else {
        salida.push("<a>");
      }
      pila.push({ tag, modo: "emitir" });
      continue;
    }

    salida.push(`<${tag}>`);
    pila.push({ tag, modo: "emitir" });
  }

  salida.push(escaparTexto(html.slice(ultimo)));
  cerrarHasta(0);

  return sacarEmojisPerdidos(limpiarEspacios(reescribirUrlsSueltas(reescribirEnlaces(salida.join("")))));
}

/**
 * Los emojis de 4 bytes (📱, 🔥, 💡…) no entraron en la base del WordPress y
 * quedaron como un `?` suelto: "? Mejor cámara". En el sitio viejo se ven así
 * también. Un signo de pregunta de verdad va pegado a la palabra ("¿Cuál?"),
 * así que uno al comienzo de un título, párrafo o línea, o con espacio a los
 * dos lados, es un emoji perdido y se saca.
 */
export function sacarEmojisPerdidos(texto: string): string {
  return texto
    .replace(/(^|<(?:h[1-6]|p|li|td|th)>|<br \/>)[ \t]*\?[ \t]+/g, "$1")
    .replace(/[ \t]\?(?=[ \t]|$)/g, "");
}

/**
 * Descripción de una nota que no trae una escrita en el preámbulo: las
 * primeras oraciones enteras del excerpt de WordPress, hasta `max` caracteres
 * (lo que Google muestra). El excerpt viene cortado en cualquier lado y
 * termina en "[…]", así que tal cual no sirve.
 */
export function resumen(texto: string, max = 160): string {
  const limpio = texto.replace(/\s*\[…\]\s*$/, "").trim();
  if (limpio.length <= max) return limpio;
  let salida = "";
  for (const oracion of limpio.split(/(?<=[.!?…])\s+/)) {
    const siguiente = salida ? `${salida} ${oracion}` : oracion;
    if (siguiente.length > max) break;
    salida = siguiente;
  }
  if (salida) return salida;
  // Una sola oración más larga que el máximo: se corta en la última palabra entera.
  const corte = limpio.slice(0, max - 1);
  return `${corte.slice(0, corte.lastIndexOf(" ")).replace(/[\s,;:]+$/, "")}…`;
}

/** Colapsa la basura que queda al borrar etiquetas. */
function limpiarEspacios(html: string): string {
  return html
    .replace(
      /<\/(p|li|h2|h3|h4|tr|td|th)>\s*<(p|li|h2|h3|h4|tr|td|th|table|ul|ol|blockquote)>/g,
      "</$1>\n<$2>",
    )
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    // El espacio entre dos etiquetas es indentación y se puede ir. El espacio
    // entre un texto y una etiqueta NO: "Texto <strong>grueso</strong>" tiene
    // que seguir siendo "Texto <strong>", no "Textogrueso". Por eso el patrón
    // exige una `>` inmediatamente antes del espacio.
    .replace(/>([ \t]+)</g, "><")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Primer `<h2>` del artículo. */
export function primerSubtitulo(html: string): string | null {
  const m = /<h2[^>]*>([\s\S]*?)<\/h2>/i.exec(html);
  return m ? aTextoPlano(m[1]) : null;
}

/** Lo que los autores escribieron arriba del artículo, ya separado del cuerpo. */
export type GuiaMeta = {
  etiqueta: string;
  subtitulo: string;
  descripcion: string;
  actualizacion: string;
  cobertura: string;
  /** Ruta interna de la categoría, sin validar contra la base. */
  categoria: string;
};

/**
 * Separa el preámbulo del artículo del cuerpo.
 *
 * Los cinco artículos arrancan con la misma estructura de seis renglones, escrita
 * a mano dentro de WordPress:
 *
 *   1. una etiqueta ("GUÍA DEFINITIVA 2026")
 *   2. el subtítulo real ("GUÍA DEFINITIVA: CÓMO ELEGIR ...")
 *   3. una línea de resumen, que sirve de descripción para Google
 *   4. "Publicado para:" con la URL de categoría de WooCommerce
 *   5. "Actualización:" con el trimestre
 *   6. "Cobertura:" con las provincias
 *
 * Eso no es contenido del artículo: la página ya muestra el título y el
 * subtítulo, y la URL de WooCommerce apuntaría al sitio viejo. Se separa para
 * guardarlo como metadata y dejar el cuerpo desde el índice de contenidos.
 */
export function separarPreambulo(html: string): { meta: GuiaMeta; cuerpo: string } {
  const lineas = html.split("\n");
  const meta: GuiaMeta = {
    etiqueta: "",
    subtitulo: "",
    descripcion: "",
    actualizacion: "",
    cobertura: "",
    categoria: "",
  };

  let i = 0;
  const siguiente = () => (i < lineas.length ? aTextoPlano(lineas[i]).trim() : "");

  // Los primeros renglones sin etiquetas son etiqueta, subtítulo y resumen. Se
  // toman solo si son texto pelado: si arrancara con un <h2>, ya es contenido.
  while (i < 6) {
    const cruda = lineas[i] ?? "";
    const texto = siguiente();
    if (!texto) {
      i += 1;
      continue;
    }
    if (/^<[a-z]/i.test(cruda)) break;
    if (!meta.etiqueta && /GU[IÍ]A|OFICIAL|DEFINITIVA|ACTUALIZADA/i.test(texto) && texto.length < 40) {
      meta.etiqueta = texto;
    } else if (!meta.subtitulo && texto.length < 120) {
      meta.subtitulo = texto;
    } else if (!meta.descripcion) {
      meta.descripcion = texto;
    } else {
      break;
    }
    i += 1;
  }

  // Los renglones de metadata vienen como "<strong>Clave:</strong> valor".
  for (; i < 10; i += 1) {
    const texto = siguiente();
    if (!texto) continue;
    const clave = /^([\s\S]{0,40}?):\s*([\s\S]*)$/.exec(texto);
    if (!clave) break;
    const nombre = aTextoPlano(clave[1]).trim().toLowerCase();
    const valor = clave[2].replace(/\s*\|.*$/, "").trim();

    if (nombre.startsWith("publicado")) {
      // "CordobaDigital.net/categoria-producto/monopatines-electricos/"
      const m = /categoria-producto\/([^/\s]+(?:\/[^/\s]+)*)/i.exec(valor);
      if (m) meta.categoria = `/categoria/${m[1].replace(/\/+$/, "")}`;
    } else if (nombre.startsWith("actualizaci")) {
      meta.actualizacion = valor;
    } else if (nombre.startsWith("cobertura")) {
      meta.cobertura = valor.replace(/^Argentina\s*/i, "").replace(/[()]/g, "").trim();
    } else {
      break;
    }
  }

  // El cuerpo arranca en la primera línea con etiquetas desde acá.
  while (i < lineas.length && !/^<[a-z]/i.test(lineas[i] ?? "")) i += 1;

  return { meta, cuerpo: lineas.slice(i).join("\n").trim() };
}

/** Cuenta de palabras del artículo, para el checklist de la migración. */
export function contarPalabras(html: string): number {
  const texto = aTextoPlano(html);
  return texto ? texto.split(/\s+/).length : 0;
}
