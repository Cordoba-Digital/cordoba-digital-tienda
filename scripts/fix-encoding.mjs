/**
 * Repare la doble codificación UTF-8 en archivos del proyecto.
 *
 * Contexto: unas ediciones hechas con PowerShell `Set-Content -Encoding UTF8`
 * leyeron los .tsx con la página de códigos del sistema (cp1252) y los
 * volvieron a guardar como UTF-8. Cada acento quedó escrito dos veces:
 *
 *   "ó"  ->  UTF-8 C3 B3  ->  cp1252 lee "Ã³"  ->  se guarda como UTF-8
 *
 * El archivo queda MIXTO: los caracteres que viven en el rango 0x80-0x9F de
 * cp1252 (comillas "", raya, copyright)-are correctos, porque cp1252 los mapea
 * de vuelta al mismo carácter. Por eso no sirve un round-trip global con
 * latin1: rompe las partes buenas.
 *
 * Lo que hace este script es decodificar SOLO las secuencias que tienen forma
 * de UTF-8 multibyte (lead byte + 1 o 2 continuation bytes) y dejar el resto
 * intacto. Es idempotente: si no encuentra nada, no toca el archivo.
 *
 * Uso: node scripts/fix-encoding.mjs [archivo ...]
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Bytes iniciales válidos en UTF-8 (como code point latin1) y cuántos bytes de
 * continuación necesitan. Son NÚMEROS, no arrays: con un array, `1 + need`
 * concatena en string ("11") y el índice del bucle se descontrola.
 */
const LEADS = {
  "Â": 1, // C2 -> U+0080..U+00BF
  "Ã": 1, // C3 -> U+00C0..U+00FF
  "Å": 1, // C5 -> U+0140..U+017F
  "â": 2, // E2 -> U+2000..U+20FF
  // Los emojis son 4 bytes UTF-8 (F0 9F 94 A5 = 🔥). cp1252 los lee como
  // "ð" + 3 caracteres: "ðŸ”¥". Hay que pedir 3 continuaciones, no 1, o el
  // emoji queda roto y nadie lo detecta (el "Ã" no aparece nunca).
  "ð": 3, // F0 -> U+1000..U+3FFFF (todo emoji cae acá)
  "ô": 3, // F4 -> U+100000..U+10FFFF
};

/**
 * cp1252 usa los bytes 0x80-0x9F para caracteres imprimibles (comillas
 * tipográficas, raya, ©, ×…). Cuando PowerShell leyó el UTF-8 con esa página
 * de códigos, esos bytes se volvieron el carácter especial, así que para
 * revertir hay que mapear "—" otra vez a 0x97 y seguir decodificando.
 */
const CP1252_REVERSE = new Map(
  Object.entries({
    "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85,
    "†": 0x86, "‡": 0x87, "ˆ": 0x88, "‰": 0x89, "Š": 0x8a,
    "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e, "‘": 0x91, "’": 0x92,
    "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97,
    "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b, "œ": 0x9c,
    "ž": 0x9e, "Ÿ": 0x9f,
  }),
);

/** Devuelve el byte que el carácter representa en cp1252, o null. */
function byteOf(ch) {
  if (ch === undefined) return null;
  const cp = ch.codePointAt(0);
  const special = CP1252_REVERSE.get(ch);
  if (special !== undefined) return special;
  return cp >= 0x80 && cp <= 0xbf ? cp : null;
}

/** Convierte el texto decodificando únicamente las secuencias UTF-8 válidas. */
export function repair(text) {
  let out = "";
  let i = 0;
  let fixed = 0;

  while (i < text.length) {
    const ch = text[i];
    const need = LEADS[ch];
    if (!need) {
      out += ch;
      i += 1;
      continue;
    }

    // Un lead byte produce un carácter ASCII o de 2-3 bytes. El ASCII no se
    // duplica al pasar por cp1252, así que solo reconstruimos los multibyte.
    const bytes = [ch.codePointAt(0)];
    let ok = true;
    for (let n = 0; n < need; n += 1) {
      const byte = byteOf(text[i + 1 + n]);
      if (byte === null) {
        ok = false;
        break;
      }
      bytes.push(byte);
    }

    if (!ok) {
      out += ch;
      i += 1;
      continue;
    }

    const decoded = Buffer.from(bytes).toString("utf8");
    if (decoded.includes("\uFFFD")) {
      out += ch;
      i += 1;
      continue;
    }

    out += decoded;
    fixed += 1;
    i += 1 + need; // `need` es un número: ver LEADS arriba.
  }

  return { text: out, fixed };
}

const SOURCE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".css"]);

/** Lista recursivamente los archivos de código de un directorio. */
export function listSourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) listSourceFiles(full, out);
    else if (SOURCE_EXTS.has(extname(full))) out.push(full);
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const files = args.length
    ? args
    : listSourceFiles(resolve(process.cwd(), "src")).map((p) => relative(process.cwd(), p));

  let changed = 0;
  for (const rel of files) {
    const path = resolve(process.cwd(), rel);
    const original = readFileSync(path, "utf8");
    // El BOM no es contenido: se va para que el archivo sea UTF-8 limpio.
    const withoutBom = original.replace(/^\uFEFF/, "");
    const { text, fixed } = repair(withoutBom);

    if (fixed === 0 || text === withoutBom) {
      continue;
    }

    writeFileSync(path, text, "utf8");
    changed += 1;
    console.log(`[fix-encoding] ${rel}: ${fixed} secuencias reparadas`);
  }

  console.log(
    changed === 0
      ? `[fix-encoding] ${files.length} archivos revisados, ninguno estaba corrupto.`
      : `[fix-encoding] ${changed} archivo(s) corregidos de ${files.length}.`,
  );
}

// Solo se ejecuta si este archivo es el punto de entrada: `check-accents.mjs`
// importa `repair` y no debe disparar la escritura.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}