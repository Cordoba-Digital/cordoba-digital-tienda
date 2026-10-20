"use client";

import { useState } from "react";

import { money } from "@/lib/format";
import type { TransferAccount } from "@/lib/transfer-account";

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        } catch {
          /* ignore */
        }
      }}
      className="shrink-0 whitespace-nowrap rounded-lg border border-ink-300 bg-surface px-2.5 py-1 text-xs font-bold text-ink-700 transition hover:border-brand-300 hover:text-brand-700"
    >
      {copied ? "¡Copiado!" : (label ?? "Copiar")}
    </button>
  );
}

/**
 * Datos de la cuenta para transferir, con el monto y botones para copiar cada
 * dato. Lo usan el checkout (antes de confirmar) y la página del pedido. El
 * monto se copia sin puntos, que es como lo aceptan los bancos y billeteras.
 */
export function TransferDetails({ account, amount }: { account: TransferAccount; amount: number }) {
  return (
    <div className="@container rounded-xl border border-ink-200 bg-surface p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-600">Transferencia bancaria</p>
      <dl className="mt-2 space-y-1.5 text-sm">
        <div className="flex flex-col gap-0.5 @sm:flex-row @sm:items-center @sm:justify-between @sm:gap-2">
          <dt className="text-ink-600">Monto</dt>
          <dd className="flex items-center justify-between gap-2 font-extrabold text-ink-900">
            {money(amount)}
            <CopyButton value={String(amount)} />
          </dd>
        </div>
        {account.number ? (
          <div className="flex flex-col gap-0.5 @sm:flex-row @sm:items-center @sm:justify-between @sm:gap-2">
            <dt className="text-ink-600">{account.numberLabel}</dt>
            <dd className="flex items-center justify-between gap-2 font-semibold text-ink-900">
              <span className="min-w-0 break-all text-xs tabular-nums @sm:text-sm">{account.number}</span>
              <CopyButton value={account.number} />
            </dd>
          </div>
        ) : null}
        {account.alias ? (
          <div className="flex flex-col gap-0.5 @sm:flex-row @sm:items-center @sm:justify-between @sm:gap-2">
            <dt className="text-ink-600">Alias</dt>
            <dd className="flex items-center justify-between gap-2 font-semibold text-ink-900">
              <span className="min-w-0 break-all">{account.alias}</span>
              <CopyButton value={account.alias} />
            </dd>
          </div>
        ) : null}
        <div className="flex flex-col gap-0.5 @sm:flex-row @sm:items-center @sm:justify-between @sm:gap-2">
          <dt className="text-ink-600">Titular</dt>
          <dd className="font-semibold text-ink-900 @sm:text-right">{account.holder}</dd>
        </div>
        {account.cuit ? (
          <div className="flex flex-col gap-0.5 @sm:flex-row @sm:items-center @sm:justify-between @sm:gap-2">
            <dt className="text-ink-600">CUIT</dt>
            <dd className="font-semibold text-ink-900">{account.cuit}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
