/**
 * `pg` 8 ya trata `sslmode=require` (lo que trae la URL de Neon) como
 * `verify-full`, pero avisa en cada arranque que en `pg` 9 va a ser más débil.
 * Se pide `verify-full` explícito: mismo comportamiento de hoy, sin el aviso,
 * y sin bajar la seguridad cuando se actualice `pg`.
 */
export function withVerifiedSsl(url: string): string {
  return url.replace(/([?&]sslmode=)(?:prefer|require|verify-ca)(?=&|$)/i, "$1verify-full");
}
