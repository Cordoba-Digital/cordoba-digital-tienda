/** `decodeURIComponent` tira URIError con `%` sueltos (`foo%bar`). */
export function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Las formas en que puede estar guardado en la base el slug de una URL.
 *
 * WordPress guarda percent-encoded lo que no es ASCII, y los migradores
 * copiaron esos slugs tal cual: 23 productos con `...samsung-55%e2%80%b3-...`
 * y dos notas del blog que arrancan con un emoji (`%f0%9f%93%b1-que-celular-...`).
 * Un lookup directo no los encuentra, y además Next pasa el slug CRUDO a
 * `generateMetadata` y el DECODIFICADO al componente de página (comprobado en
 * producción), así que no alcanza con mirar uno de los dos.
 *
 * Por eso se prueban crudo, decodificado, y cada uno re-codificado con el
 * hexadecimal en mayúsculas y en minúsculas. Todas son transformaciones
 * deterministas de la misma cadena: un slug que no existe sigue sin encontrar
 * nada y responde 404.
 */
export function slugCandidates(slug: string): string[] {
  const seen = new Set<string>([slug]);
  const add = (value: string) => {
    if (value && value !== slug) seen.add(value);
  };
  const decoded = safeDecode(slug);
  add(decoded);
  for (const base of [slug, decoded]) {
    const encoded = encodeURIComponent(base);
    add(encoded);
    add(encoded.replace(/%[0-9A-F]{2}/g, (m) => m.toLowerCase()));
  }
  return [...seen];
}
