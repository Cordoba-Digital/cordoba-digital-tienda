"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Spinner } from "@/components/ui";
import { money } from "@/lib/format";
import { ORDER_STATUS_FLOW, statusIndex, statusLabel } from "@/lib/pricing";

type TrackedOrder = {
  code: string;
  status: string;
  customerName: string;
  deliveryLabel: string;
  deliveryEta: string;
  total: number;
  createdAt: string;
};

export function TrackingForm() {
  const params = useSearchParams();
  const [code, setCode] = useState(params.get("codigo") ?? "");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<TrackedOrder | null>(null);

  const lookup = useCallback(async (orderCode: string, orderEmail: string) => {
    if (!orderCode.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const query = orderEmail.trim() ? `?email=${encodeURIComponent(orderEmail.trim())}` : "";
      const res = await fetch(`/api/orders/${encodeURIComponent(orderCode.trim().toUpperCase())}${query}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setOrder(null);
        setError(data.error ?? "No encontramos ese pedido.");
      } else {
        setOrder({
          code: data.order.code,
          status: data.order.status,
          customerName: data.order.customerName,
          deliveryLabel: data.order.deliveryLabel,
          deliveryEta: data.order.deliveryEta,
          total: data.order.total,
          createdAt: new Date(data.order.createdAt).toLocaleDateString("es-AR"),
        });
      }
    } catch {
      setError("Hubo un problema al consultar. Probá de nuevo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = params.get("codigo");
    if (!initial) return;
    const id = window.setTimeout(() => void lookup(initial, ""), 0);
    return () => window.clearTimeout(id);
  }, [params, lookup]);

  const current = order ? statusIndex(order.status) : 0;

  return (
    <div className="mt-6 space-y-5">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void lookup(code, email);
        }}
        className="card-surface grid gap-3 p-5 sm:grid-cols-[1fr_1fr_auto]"
      >
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-500">Código de pedido</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="CD-ABC123"
            className="h-11 w-full rounded-xl border border-ink-200 px-3.5 text-sm uppercase outline-none focus:border-brand-400"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-500">Email (opcional)</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            className="h-11 w-full rounded-xl border border-ink-200 px-3.5 text-sm outline-none focus:border-brand-400"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? <Spinner className="h-4 w-4" /> : null}
          Buscar
        </button>
      </form>

      {error ? (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>
      ) : null}

      {order ? (
        <div className="card-surface animate-rise p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-ink-400">Pedido {order.code}</p>
              <p className="text-lg font-extrabold text-ink-900">{statusLabel(order.status)}</p>
              <p className="text-xs text-ink-500">
                {order.deliveryLabel} · {order.deliveryEta}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-ink-400">Total</p>
              <p className="text-xl font-black text-ink-900">{money(order.total)}</p>
            </div>
          </div>

          <ol className="mt-4 grid gap-3 sm:grid-cols-5">
            {ORDER_STATUS_FLOW.map((stage, index) => {
              const done = index <= current;
              return (
                <li key={stage.id} className="text-center">
                  <span
                    className={`mx-auto grid h-8 w-8 place-items-center rounded-full text-xs font-bold ${
                      done ? "bg-emerald-500 text-white" : "bg-ink-100 text-ink-400"
                    }`}
                  >
                    {done ? "✓" : index + 1}
                  </span>
                  <p className={`mt-1.5 text-[11px] font-semibold ${done ? "text-ink-900" : "text-ink-400"}`}>
                    {stage.label}
                  </p>
                </li>
              );
            })}
          </ol>

          <Link
            href={`/pedido/${order.code}`}
            className="mt-5 inline-block rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700"
          >
            Ver detalle completo
          </Link>
        </div>
      ) : null}
    </div>
  );
}
