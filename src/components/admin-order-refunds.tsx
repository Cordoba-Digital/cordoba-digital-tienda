"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatDateTime, money } from "@/lib/format";

type Refund = {
  id: number;
  amount: number;
  method: string;
  estado: string;
  reason: string;
  error: string;
  createdBy: string;
  createdAt: string;
};

const botonCls =
  "rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-bold text-white transition-[background-color,opacity] duration-150 hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-ink-100 disabled:text-ink-400";
const campoCls = "mt-1 w-full rounded-xl border border-ink-200 bg-surface px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-400";

const ESTADOS: Record<string, string> = { pendiente: "Esperando a Mercado Pago", hecho: "Hecho", fallido: "Falló" };

/**
 * Reembolsos del pedido: lo devuelto hasta ahora y, para los dueños, el
 * formulario para devolver plata (todo o una parte).
 */
export function AdminOrderRefunds({
  code,
  total,
  refunds,
  paid,
  viaMp,
  canRefund,
}: {
  code: string;
  total: number;
  refunds: Refund[];
  /** El pedido tuvo un pago acreditado. */
  paid: boolean;
  /** Se devuelve por la API de Mercado Pago (si no, se anota uno hecho por fuera). */
  viaMp: boolean;
  /** Solo dueños. */
  canRefund: boolean;
}) {
  const router = useRouter();
  const refunded = refunds.filter((r) => r.estado !== "fallido").reduce((sum, r) => sum + r.amount, 0);
  const available = Math.max(0, total - refunded);
  const [amount, setAmount] = useState(String(available));
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  // El formulario arranca cerrado: devolver plata es la excepción, no lo que se hace en cada pedido.
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  if (!paid && refunds.length === 0) return null;

  const value = Math.floor(Number(amount.replace(/[^\d]/g, "")));
  const valid = value > 0 && value <= available && reason.trim().length > 0;
  const full = value === available && refunded === 0;

  async function send() {
    setWorking(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(code)}/refunds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: value, reason: reason.trim() }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "No se pudo hacer el reembolso.");
        return;
      }
      setConfirming(false);
      setReason("");
      router.refresh();
    } catch {
      setError("Error de red. Antes de reintentar, fijate si el reembolso aparece en la lista.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="admin-card space-y-3 p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-ink-900">Reembolsos</h2>
        {refunded ? <span className="text-xs text-ink-500">Devuelto {money(refunded)} de {money(total)}</span> : null}
      </div>

      {refunds.length ? (
        <ul className="divide-y divide-ink-50 text-sm">
          {refunds.map((r) => (
            <li key={r.id} className="py-2 first:pt-0">
              <div className="flex justify-between gap-3">
                <span className="font-semibold text-ink-900">{money(r.amount)}</span>
                <span className={r.estado === "fallido" ? "text-red-700" : r.estado === "pendiente" ? "text-amber-700" : "text-ink-500"}>
                  {ESTADOS[r.estado] ?? r.estado}
                </span>
              </div>
              <p className="text-xs text-ink-500">
                {formatDateTime(new Date(r.createdAt))} · {r.method === "mercadopago" ? "Mercado Pago" : "Por fuera de la tienda"}
                {r.reason ? ` · ${r.reason}` : ""}
              </p>
              {r.error ? <p className="text-xs text-red-700">{r.error}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {!paid || available === 0 ? null : !canRefund ? (
        <p className="text-xs text-ink-500">Solo los dueños de la tienda pueden devolver plata.</p>
      ) : !open ? (
        <>
          {refunds.length ? null : <p className="text-xs text-ink-500">Todavía no se devolvió plata de este pedido.</p>}
          <button
            type="button"
            className="rounded-xl border border-ink-200 bg-surface px-4 py-2 text-sm font-semibold text-ink-800 transition-colors hover:bg-ink-50"
            onClick={() => setOpen(true)}
          >
            {viaMp ? "Devolver plata" : "Anotar una devolución"}
          </button>
        </>
      ) : (
        <div className="space-y-3 border-t border-ink-100 pt-3">
          <p className="text-xs text-ink-500">
            {viaMp
              ? "Se devuelve a la tarjeta o cuenta con la que pagó, por Mercado Pago."
              : "Devolvé la plata por tu cuenta (transferencia o efectivo) y anotala acá."}{" "}
            Si devolvés el total y el pedido no salió, se cancela y el stock vuelve a la tienda.
          </p>
          <label className="block">
            <span className="text-xs font-bold text-ink-600">Monto (hasta {money(available)})</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" className={campoCls} />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-ink-600">Motivo</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              placeholder="Ej.: arrepentimiento, falta de stock, diferencia de precio"
              className={campoCls}
            />
          </label>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          {confirming ? (
            <div className="space-y-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              <p>
                {viaMp ? "Vas a devolver" : "Vas a anotar una devolución de"} <strong>{money(value)}</strong>
                {full ? " (el total del pedido)" : ""}. {viaMp ? "No se puede deshacer." : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={botonCls} disabled={working} onClick={send}>
                  {working ? "Devolviendo…" : "Sí, devolver"}
                </button>
                <button type="button" className="px-3 text-sm font-semibold text-ink-600 hover:text-ink-900" disabled={working} onClick={() => setConfirming(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={botonCls} disabled={!valid} onClick={() => setConfirming(true)}>
                {viaMp ? "Devolver por Mercado Pago" : "Anotar devolución"}
              </button>
              <button type="button" className="px-3 text-sm font-semibold text-ink-600 hover:text-ink-900" onClick={() => setOpen(false)}>
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
