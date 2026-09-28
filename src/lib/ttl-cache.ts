/**
 * Caché en memoria con TTL para lecturas caras de la base.
 *
 * Por qué no `unstable_cache` de Next: en el runtime de Vercel (Next 16) lanza
 * `TypeError: b.get is not a function` al serializar la respuesta y deja las
 * páginas en 500. Como el catálogo solo cambia cuando se corre `migrate:wp`,
 * alcanza con un Map en memoria del módulo: en serverless sobrevive entre
 * invocaciones tibias de la misma lambda.
 *
 * Un `revalidateTag()` desde el migrador puede forzar el refresco si alguna vez
 * hace falta (ver `invalidateAll`).
 */
type Entry<T> = { value: T; expires: number };

const store = new Map<string, Entry<unknown>>();

/** Memoiza `loader` durante `ttlMs`. Devuelve la misma promesa mientras viva. */
export function ttlCache<T>(key: string, ttlMs: number, loader: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;

  return async () => {
    const hit = store.get(key) as Entry<T> | undefined;
    if (hit && hit.expires > Date.now()) return hit.value;

    // deduplica ráfagas concurrentes contra la base
    if (!pending) {
      pending = loader()
        .then((value) => {
          store.set(key, { value, expires: Date.now() + ttlMs });
          return value;
        })
        .finally(() => {
          pending = null;
        });
    }
    return pending;
  };
}

/** Vacía toda la caché (tests, o después de una migración). */
export function invalidateAll(): void {
  store.clear();
}
