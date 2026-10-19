import { createHash } from "node:crypto";

/**
 * USDT por red TRON (TRC20). La tienda solo da la wallet y la red: el monto en
 * USDT lo resuelve el cliente (no hay cotización). Con el TXID que carga el
 * cliente se busca la transferencia en la red y César la aprueba a mano.
 */

/** Contrato oficial de USDT en TRON. */
export const USDT_TRC20_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Decode(value: string): Buffer | null {
  let n = BigInt(0);
  for (const char of value) {
    const digit = BASE58.indexOf(char);
    if (digit < 0) return null;
    n = n * BigInt(58) + BigInt(digit);
  }
  let hex = n.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  const leadingZeros = value.length - value.replace(/^1+/, "").length;
  return Buffer.concat([Buffer.alloc(leadingZeros), Buffer.from(n === BigInt(0) ? "" : hex, "hex")]);
}

const sha256 = (data: Buffer) => createHash("sha256").update(data).digest();

/**
 * Dirección TRON válida: base58 de 25 bytes que empieza con 0x41 (por eso
 * arranca con "T") y cierra con los 4 bytes de control del doble SHA-256. Un
 * carácter mal copiado no pasa.
 */
export function isTronAddress(value: string): boolean {
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(value)) return false;
  const bytes = base58Decode(value);
  if (!bytes || bytes.length !== 25 || bytes[0] !== 0x41) return false;
  const payload = bytes.subarray(0, 21);
  const checksum = sha256(sha256(payload)).subarray(0, 4);
  return checksum.equals(bytes.subarray(21));
}

/** El TXID de TRON son 64 caracteres hexadecimales; se guarda en minúsculas. */
export function normalizeTxid(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(value) ? value : null;
}

export function tronscanTxUrl(txid: string): string {
  return `https://tronscan.org/#/transaction/${txid}`;
}

export type UsdtTransfer = {
  /** Monto en USDT como texto decimal ("150.5"), sin pasar por float. */
  amount: string;
  from: string;
  /** Cuándo entró el bloque, en ISO. */
  at: string;
};

/** "150500000" con 6 decimales → "150.5". */
export function formatTokenAmount(raw: string, decimals: number): string {
  if (!/^\d+$/.test(raw)) return "0";
  const padded = raw.padStart(decimals + 1, "0");
  const whole = padded.slice(0, padded.length - decimals).replace(/^0+(?=\d)/, "");
  const fraction = padded.slice(padded.length - decimals).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

type TronGridTransfer = {
  transaction_id?: string;
  from?: string;
  to?: string;
  type?: string;
  value?: string;
  block_timestamp?: number;
  token_info?: { address?: string; decimals?: number };
};

/**
 * Busca en TronGrid una transferencia de USDT confirmada con ese TXID que haya
 * entrado a la wallet de la tienda desde `since`. Devuelve null si todavía no
 * aparece (o no es de USDT, o fue a otra wallet). Tira error si TronGrid no
 * responde, para que quien llama no lo confunda con "no llegó".
 */
export async function findUsdtTransfer(
  { wallet, txid, since }: { wallet: string; txid: string; since: Date },
  fetchImpl: typeof fetch = fetch,
): Promise<UsdtTransfer | null> {
  const params = new URLSearchParams({
    only_to: "true",
    only_confirmed: "true",
    contract_address: USDT_TRC20_CONTRACT,
    min_timestamp: String(since.getTime() - 60 * 60 * 1000),
    limit: "200",
  });
  const headers: Record<string, string> = { accept: "application/json" };
  const apiKey = process.env.TRONGRID_API_KEY?.trim();
  if (apiKey) headers["TRON-PRO-API-KEY"] = apiKey;
  let url: string | null = `https://api.trongrid.io/v1/accounts/${wallet}/transactions/trc20?${params}`;
  // Hasta 5 páginas de 200: alcanza para una tienda chica y corta si algo se repite.
  for (let page = 0; url && page < 5; page += 1) {
    const res = await fetchImpl(url, { headers, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`TronGrid respondió ${res.status}`);
    const body = (await res.json()) as { data?: TronGridTransfer[]; meta?: { links?: { next?: string } } };
    for (const tx of body.data ?? []) {
      if (tx.transaction_id?.toLowerCase() !== txid) continue;
      if (tx.type !== "Transfer" || tx.to !== wallet || tx.token_info?.address !== USDT_TRC20_CONTRACT) return null;
      return {
        amount: formatTokenAmount(tx.value ?? "0", tx.token_info?.decimals ?? 6),
        from: tx.from ?? "",
        at: new Date(tx.block_timestamp ?? Date.now()).toISOString(),
      };
    }
    const next: string | undefined = body.meta?.links?.next;
    url = next && next.startsWith("https://api.trongrid.io/") ? next : null;
  }
  return null;
}
