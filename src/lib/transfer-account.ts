/**
 * Cuenta a la que el cliente transfiere. El repo es público, así que los datos
 * no van en el código: salen de variables de Vercel.
 *
 * - `TRANSFER_CBU`: CBU o CVU (22 dígitos). Si empieza con `000` es un CVU.
 * - `TRANSFER_ALIAS`
 * - `TRANSFER_TITULAR`: nombre de quien recibe la plata, para que el cliente lo
 *   reconozca en su banco antes de confirmar.
 * - `TRANSFER_CUIT`: opcional.
 *
 * Sin CBU/CVU ni alias, o sin titular, la cuenta no está configurada y la página
 * del pedido pide los datos por WhatsApp en vez de inventarlos.
 */

export type TransferAccount = {
  /** "CBU" o "CVU", según el número. */
  numberLabel: "CBU" | "CVU";
  number: string;
  alias: string;
  holder: string;
  cuit: string;
};

type Env = Record<string, string | undefined>;

export function transferAccount(env: Env = process.env): TransferAccount | null {
  const number = (env.TRANSFER_CBU ?? "").replace(/\D/g, "");
  const alias = (env.TRANSFER_ALIAS ?? "").trim();
  const holder = (env.TRANSFER_TITULAR ?? "").trim();
  const cuit = (env.TRANSFER_CUIT ?? "").trim();
  const validNumber = number.length === 22 ? number : "";
  if ((!validNumber && !alias) || !holder) return null;
  return {
    numberLabel: validNumber.startsWith("000") ? "CVU" : "CBU",
    number: validNumber,
    alias,
    holder,
    cuit,
  };
}
