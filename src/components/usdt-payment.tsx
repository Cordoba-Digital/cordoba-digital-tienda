"use client";

import { CircleCheck, Coins, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { QrCode } from "@/components/qr-code";
import { CopyButton } from "@/components/transfer-details";
import { money } from "@/lib/format";

export type UsdtPaymentInfo = {
  /** Wallet de la tienda; null si USDT se apagó después del pedido. */
  wallet: string | null;
  txid: string | null;
  /** USDT que se vieron llegar en la red, cuando ya se verificó. */
  amount: string | null;
};

/**
 * Cómo pagar un pedido con USDT: la wallet con su QR, la red y el campo para
 * pegar el TXID. Con el TXID, el servidor busca la transacción en la red y le
 * avisa a la tienda; el pedido se confirma cuando César lo aprueba.
 */
export function UsdtPaymentPanel({ code, total, info }: { code: string; total: number; info: UsdtPaymentInfo }) {
  const router = useRouter();
  const [txid, setTxid] = useState("");
  const [editing, setEditing] = useState(!info.txid);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(code)}/usdt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txid }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "No se pudo guardar el TXID.");
        return;
      }
      setEditing(false);
      setTxid("");
      router.refresh();
    } catch {
      setError("Error de red. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card-surface border border-amber-200 bg-amber-50/50 p-5 md:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800" aria-hidden>
          <Coins className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold text-ink-900">Cómo completar tu pago</h2>
          <p className="mt-0.5 text-sm text-ink-600">
            Enviá el equivalente en USDT a <strong>{money(total)}</strong> por red TRON (TRC20). El monto en USDT y la comisión de la
            red corren por tu cuenta.
          </p>
        </div>
      </div>

      {info.wallet ? (
        <div className="mt-4 flex flex-col items-center gap-4 rounded-xl border border-ink-100 bg-surface p-4 sm:flex-row sm:items-start">
          <QrCode value={info.wallet} label="QR de la wallet para pagar con USDT" />
          <dl className="w-full min-w-0 space-y-2 text-sm">
            <div>
              <dt className="text-ink-500">Red</dt>
              <dd className="font-extrabold text-ink-900">TRON (TRC20)</dd>
            </div>
            <div>
              <dt className="text-ink-500">Wallet</dt>
              <dd className="flex items-center justify-between gap-2 font-semibold text-ink-900">
                <span className="min-w-0 break-all font-mono text-xs sm:text-sm">{info.wallet}</span>
                <CopyButton value={info.wallet} />
              </dd>
            </div>
            <p className="rounded-lg bg-amber-100/70 p-2 text-xs font-semibold text-amber-900">
              Solo USDT por red TRON. Un envío por otra red o de otra moneda no llega y no se puede recuperar.
            </p>
          </dl>
        </div>
      ) : (
        <a
          href={`https://wa.me/5493516777774?text=${encodeURIComponent(`Hola! Quiero pagar con USDT el pedido ${code}`)}`}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white transition hover:bg-emerald-600 sm:w-auto"
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          Pedir la wallet por WhatsApp
        </a>
      )}

      {info.amount ? (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            Vimos llegar <strong>{info.amount} USDT</strong> a la wallet. Lo revisamos, confirmamos el pedido y te avisamos.
          </span>
        </p>
      ) : info.wallet ? (
        <div className="mt-4 rounded-xl border border-ink-100 bg-surface p-4">
          {info.txid && !editing ? (
            <div className="text-sm text-ink-700">
              <p>
                Recibimos tu TXID. Lo estamos buscando en la red: cuando aparezca, revisamos el pago y confirmamos el pedido.
              </p>
              <p className="mt-1 break-all font-mono text-xs text-ink-500">{info.txid}</p>
              <button type="button" onClick={() => setEditing(true)} className="mt-2 text-xs font-bold text-brand-700 hover:underline">
                Corregir el TXID
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <label className="block">
                <span className="text-sm font-bold text-ink-900">Ya pagué: pegá el TXID</span>
                <span className="mt-0.5 block text-xs text-ink-500">
                  Es el código de la transacción (64 letras y números). Lo encontrás en el detalle del envío de tu wallet o exchange.
                </span>
                <input
                  value={txid}
                  onChange={(e) => setTxid(e.target.value)}
                  disabled={busy}
                  autoComplete="off"
                  spellCheck={false}
                  className="mt-2 h-11 w-full rounded-xl border border-ink-200 bg-surface px-3.5 font-mono text-xs text-ink-900 outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
                />
              </label>
              <button
                type="submit"
                disabled={busy || !txid.trim()}
                className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl bg-ink-900 px-5 text-sm font-bold text-white transition hover:bg-ink-700 disabled:bg-ink-300 sm:w-auto"
              >
                {busy ? "Enviando…" : "Enviar TXID"}
              </button>
              {error ? (
                <p role="alert" className="mt-2 text-sm font-semibold text-red-600">
                  {error}
                </p>
              ) : null}
            </form>
          )}
        </div>
      ) : null}
    </section>
  );
}
