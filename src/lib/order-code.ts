/** Código público de un pedido (`CD-` y seis caracteres sin 0/O ni 1/I para dictarlo sin errores). */
export function newOrderCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let suffix = "";
  for (const byte of bytes) suffix += alphabet[byte % alphabet.length];
  return `CD-${suffix}`;
}
