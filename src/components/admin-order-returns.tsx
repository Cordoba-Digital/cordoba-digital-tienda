"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatDateTime } from "@/lib/format";

type Item = { id: number; name: string; quantity: number; returned: number };
type Return = {
  id: number;
  items: { orderItemId: number; name: string; quantity: number }[];
  reason: string;
  createdBy: string;
  createdAt: string;
};

const botonCls =
  "rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-bold text-white transition-[background-color,opacity] duration-150 hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60";
const campoCls = "mt-1 w-full rounded-xl border border-ink-200 bg-surface px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-400";

/**
 * Devoluciones de producto: lo que volvió al local y el formulario para anotar
 * lo que llega (el stock vuelve a la tienda). Solo en pedidos que salieron.
 */
export function AdminOrderReturns({
  code,
  items,
  returns,
  canReturn,
}: {
  code: string;
  items: Item[];
  returns: Return[];
  /** El pedido está enviado o entregado. */
  canReturn: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  if (!canReturn && returns.length === 0) return null;

  const pending = items.filter((i) => i.quantity - i.returned > 0);
  const chosen = items
    .map((i) => ({ orderItemId: i.id, quantity: Math.floor(Number(quantities[i.id] ?? 0)) || 0 }))
    .filter((i) => i.quantity > 0);
  const valid =
    chosen.length > 0 &&
    reason.trim().length > 0 &&
    chosen.every((c) => {
      const item = items.find((i) => i.id === c.orderItemId)!;
      return c.quantity <= item.quantity - item.returned;
    });

  async function send() {
    setWorking(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(code)}/returns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: chosen, reason: reason.trim() }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "No se pudo anotar la devolución.");
        return;
      }
      setOpen(false);
      setQuantities({});
      setReason("");
      router.refresh();
    } catch {
      setError("Error de red. Antes de reintentar, fijate si la devolución aparece en la lista.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="admin-card space-y-3 p-5">
      <h2 className="text-sm font-bold text-ink-900">Devoluciones de producto</h2>

      {returns.length ? (
        <ul className="divide-y divide-ink-50 text-sm">
          {returns.map((r) => (
            <li key={r.id} className="py-2 first:pt-0">
              <p className="font-semibold text-ink-900">{r.items.map((i) => `${i.quantity} × ${i.name}`).join(", ")}</p>
              <p className="text-xs text-ink-500">
                {formatDateTime(new Date(r.createdAt))}
                {r.reason ? ` · ${r.reason}` : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      {!canReturn || pending.length === 0 ? null : !open ? (
        <button type="button" className="text-sm font-semibold text-brand-700 hover:underline" onClick={() => setOpen(true)}>
          Anotar un producto devuelto
        </button>
      ) : (
        <div className="space-y-3 border-t border-ink-100 pt-3">
          <p className="text-xs text-ink-500">
            Anotalo cuando el producto llega al local: las unidades vuelven al stock. La plata se devuelve aparte, en Reembolsos.
          </p>
          {pending.map((item) => (
            <label key={item.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 text-ink-800">
                {item.name}
                <span className="block text-xs text-ink-500">
                  Compró {item.quantity}
                  {item.returned ? `, ya devolvió ${item.returned}` : ""}
                </span>
              </span>
              <input
                type="number"
                min={0}
                max={item.quantity - item.returned}
                value={quantities[item.id] ?? ""}
                placeholder="0"
                onChange={(e) => setQuantities((q) => ({ ...q, [item.id]: e.target.value }))}
                className="w-20 rounded-xl border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-900 outline-none focus:border-brand-400"
              />
            </label>
          ))}
          <label className="block">
            <span className="text-xs font-bold text-ink-600">Motivo</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              placeholder="Ej.: arrepentimiento, falla, cambio por otro modelo"
              className={campoCls}
            />
          </label>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={botonCls} disabled={!valid || working} onClick={send}>
              {working ? "Anotando…" : "Recibí el producto"}
            </button>
            <button type="button" className="px-3 text-sm font-semibold text-ink-600 hover:text-ink-900" disabled={working} onClick={() => setOpen(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
