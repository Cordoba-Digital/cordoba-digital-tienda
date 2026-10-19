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
 *
 * Lo que se carga en Admin → Medios de pago tiene prioridad sobre estas
 * variables, que quedan de respaldo (ver `transfer-account-server.ts`).
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

/** Lo que se carga en Admin → Medios de pago. */
export type TransferAccountInput = { number: string; alias: string; holder: string; cuit: string };

/**
 * CBU y CVU tienen dos dígitos verificadores: el 8.º cierra el bloque del banco
 * y el 22.º el de la cuenta. Con esto un dígito mal tipeado se rechaza antes de
 * que un cliente transfiera a una cuenta que no existe.
 */
export function isValidCbu(value: string): boolean {
  if (!/^\d{22}$/.test(value)) return false;
  const d = [...value].map(Number);
  const check = (digits: number[], weights: number[]) =>
    (10 - (weights.reduce((sum, w, i) => sum + w * digits[i], 0) % 10)) % 10;
  return check(d.slice(0, 7), [7, 1, 3, 9, 7, 1, 3]) === d[7] && check(d.slice(8, 21), [3, 9, 7, 1, 3, 9, 7, 1, 3, 9, 7, 1, 3]) === d[21];
}

const ALIAS_RE = /^[a-z0-9.-]{6,20}$/;

/**
 * Valida y limpia los datos que manda el panel. Pide número y alias (los dos
 * los ve el cliente en el checkout) y el titular; el CUIT es opcional.
 */
export function validateTransferInput(raw: unknown): { ok: true; value: TransferAccountInput } | { ok: false; error: string } {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const text = (key: string) => (typeof body[key] === "string" ? (body[key] as string).trim() : "");
  const number = text("number").replace(/[\s-]/g, "");
  const alias = text("alias").toLowerCase();
  const holder = text("holder").replace(/\s+/g, " ");
  const cuit = text("cuit").replace(/\D/g, "");
  if (!isValidCbu(number)) return { ok: false, error: "El CBU o CVU tiene que tener 22 números y ser válido. Revisá que no falte ni sobre ningún dígito." };
  if (!ALIAS_RE.test(alias)) return { ok: false, error: "El alias tiene que tener entre 6 y 20 caracteres: letras, números, puntos o guiones." };
  if (holder.length < 3 || holder.length > 80) return { ok: false, error: "Escribí el nombre del titular de la cuenta." };
  if (cuit && cuit.length !== 11) return { ok: false, error: "El CUIT o CUIL tiene que tener 11 números." };
  const formattedCuit = cuit ? `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}-${cuit.slice(10)}` : "";
  return { ok: true, value: { number, alias, holder, cuit: formattedCuit } };
}

/** Cómo la ve el cliente. */
export function accountFromInput(input: TransferAccountInput): TransferAccount {
  return {
    numberLabel: input.number.startsWith("000") ? "CVU" : "CBU",
    number: input.number,
    alias: input.alias,
    holder: input.holder,
    cuit: input.cuit,
  };
}
