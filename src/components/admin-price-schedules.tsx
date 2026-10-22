"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { discountPercent, formatDateTime, money } from "@/lib/format";
import type { PriceScheduleRow } from "@/lib/price-schedules";

export type ScheduleProduct = { slug: string; name: string; price: number; compareAtPrice: number | null; stock: number };

const STATE: Record<string, { label: string; cls: string }> = {
  programada: { label: "Programada", cls: "bg-amber-500 text-ink-900" },
  activa: { label: "En curso", cls: "bg-emerald-700 text-white" },
  terminada: { label: "Terminada", cls: "bg-ink-700 text-white" },
  cancelada: { label: "Cancelada", cls: "bg-ink-300 text-ink-900" },
};

const inputCls =
  "h-10 w-full min-w-0 border border-ink-200 bg-surface px-3 text-sm text-ink-900 outline-none focus:border-ink-400";

const digitsOnly = (value: string) => value.replace(/\D/g, "");
const withDots = (value: string) => (value ? Number(value).toLocaleString("es-AR") : "");

export function AdminPriceSchedules({ rows, preset }: { rows: PriceScheduleRow[]; preset: ScheduleProduct | null }) {
  const router = useRouter();
  const [product, setProduct] = useState<ScheduleProduct | null>(preset);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ScheduleProduct[]>([]);
  const [offerPrice, setOfferPrice] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const id = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/products?q=${encodeURIComponent(q)}&perPage=8`, { signal: controller.signal });
        const data = (await res.json().catch(() => ({}))) as { items?: ScheduleProduct[] };
        setResults(data.items ?? []);
      } catch {
        // Se canceló porque siguió escribiendo.
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(id);
    };
  }, [query]);

  const shown = query.trim().length >= 2 ? results : [];
  const off = product && Number(offerPrice) ? discountPercent(Number(offerPrice), product.price) : 0;

  async function send(target: string, url: string, init: RequestInit): Promise<boolean> {
    setBusy(target);
    setError("");
    try {
      const res = await fetch(url, init);
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "No se pudo guardar.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Error de red. Probá de nuevo.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!product) {
      setError("Elegí el producto.");
      return;
    }
    const ok = await send("nueva", "/api/admin/price-schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: product.slug, offerPrice: Number(offerPrice), startsAt, endsAt }),
    });
    if (ok) {
      setProduct(null);
      setOfferPrice("");
    }
  }

  function cancel(row: PriceScheduleRow) {
    const question =
      row.status === "activa"
        ? `¿Terminar ya la oferta de ${row.productName ?? row.productSlug}? Vuelve al precio de antes.`
        : `¿Cancelar la oferta programada de ${row.productName ?? row.productSlug}?`;
    if (!window.confirm(question)) return;
    void send(String(row.id), `/api/admin/price-schedules/${row.id}`, { method: "DELETE" });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={save} className="admin-card space-y-3 p-4">
        <p className="text-sm font-bold text-ink-900">Nueva oferta</p>

        {product ? (
          <div className="flex flex-wrap items-start justify-between gap-3 border border-ink-200 p-3">
            <div className="min-w-0">
              <p className="font-bold text-ink-900">{product.name}</p>
              <p className="text-xs text-ink-500">
                Precio actual {money(product.price)} · Stock {product.stock}
              </p>
              {product.stock <= 1 ? (
                <p className="mt-1 text-xs font-semibold text-amber-700">
                  Con stock {product.stock} la tienda no muestra cantidad. Para el evento cargá la cantidad real en{" "}
                  <Link href={`/admin/productos/${encodeURIComponent(product.slug)}`} className="underline">
                    el producto
                  </Link>
                  .
                </p>
              ) : null}
            </div>
            <button type="button" onClick={() => setProduct(null)} className="border border-ink-300 px-3 py-1.5 text-xs font-bold text-ink-700 hover:border-ink-500">
              Cambiar
            </button>
          </div>
        ) : (
          <div className="relative">
            <label className="block text-xs font-semibold text-ink-600">
              Producto
              <input
                className={`${inputCls} mt-1`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscá por nombre, marca o SKU"
                autoComplete="off"
              />
            </label>
            {shown.length ? (
              <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto border border-ink-200 bg-surface shadow-lg">
                {shown.map((r) => (
                  <li key={r.slug}>
                    <button
                      type="button"
                      onClick={() => {
                        setProduct(r);
                        setQuery("");
                        setResults([]);
                      }}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-ink-50"
                    >
                      <span className="min-w-0 truncate text-ink-900">{r.name}</span>
                      <span className="shrink-0 tabular-nums text-ink-500">{money(r.price)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-xs font-semibold text-ink-600">
            Precio de oferta ($)
            <input
              className={`${inputCls} mt-1`}
              inputMode="numeric"
              value={withDots(offerPrice)}
              onChange={(e) => setOfferPrice(digitsOnly(e.target.value))}
              required
            />
            {off > 0 ? <span className="mt-1 block text-xs text-emerald-700">{off}% menos que el precio actual</span> : null}
          </label>
          <label className="block text-xs font-semibold text-ink-600">
            Empieza (hora de Córdoba)
            <input className={`${inputCls} mt-1`} type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
          </label>
          <label className="block text-xs font-semibold text-ink-600">
            Termina (hora de Córdoba)
            <input className={`${inputCls} mt-1`} type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required />
          </label>
        </div>
        <button
          type="submit"
          disabled={busy !== null}
          className="h-10 bg-ink-900 px-5 text-sm font-bold text-white transition-[background-color,color,border-color,box-shadow,opacity] duration-150 hover:bg-ink-700 disabled:cursor-default disabled:bg-ink-300"
        >
          {busy === "nueva" ? "Guardando…" : "Programar oferta"}
        </button>
      </form>
      {error ? <p role="alert" className="text-sm font-semibold text-red-600">{error}</p> : null}

      <div className="admin-table overflow-x-auto">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-500">Todavía no hay ofertas programadas.</p>
        ) : (
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs text-ink-500">
                <th className="px-4 py-2 font-semibold">Producto</th>
                <th className="px-4 py-2 font-semibold">Oferta</th>
                <th className="px-4 py-2 font-semibold">Empieza</th>
                <th className="px-4 py-2 font-semibold">Termina</th>
                <th className="px-4 py-2 font-semibold">Estado</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const state = STATE[row.status] ?? STATE.cancelada;
                const before = row.prevPrice ?? row.currentPrice;
                return (
                  <tr key={row.id} className="border-b border-ink-100 last:border-0">
                    <td className="px-4 py-3">
                      {row.productName ? (
                        <Link href={`/admin/productos/${encodeURIComponent(row.productSlug)}`} className="font-bold text-ink-900 hover:underline">
                          {row.productName}
                        </Link>
                      ) : (
                        <p className="font-bold text-ink-500">{row.productSlug}</p>
                      )}
                      {row.note ? <p className="text-xs text-ink-500">{row.note}</p> : null}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-ink-800">
                      <p className="font-bold">{money(row.offerPrice)}</p>
                      {before && before > row.offerPrice ? (
                        <p className="text-xs text-ink-500">
                          antes {money(before)} · {discountPercent(row.offerPrice, before)}% off
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-ink-800">{formatDateTime(row.startsAt)}</td>
                    <td className="px-4 py-3 tabular-nums text-ink-800">{formatDateTime(row.endsAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 text-[11px] font-bold ${state.cls}`}>{state.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.status === "programada" || row.status === "activa" ? (
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => cancel(row)}
                          className="border border-ink-300 px-3 py-1.5 text-xs font-bold text-ink-700 hover:border-ink-500 disabled:cursor-default"
                        >
                          {busy === String(row.id) ? "…" : row.status === "activa" ? "Terminar ya" : "Cancelar"}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
