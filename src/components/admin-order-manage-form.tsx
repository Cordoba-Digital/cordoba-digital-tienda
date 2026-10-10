"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ADMIN_ORDER_STATUSES } from "@/lib/pricing";

export function AdminOrderManageForm({ code, currentStatus, trackingCode }: { code: string; currentStatus: string; trackingCode: string }) {
  const router = useRouter();
  const [nextStatus, setNextStatus] = useState(currentStatus);
  const [tracking, setTracking] = useState(trackingCode);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved("");
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(code)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, trackingCode: tracking, note }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "No se pudo guardar.");
        return;
      }
      setNote("");
      setSaved("Guardado.");
      router.refresh();
    } catch {
      setError("Error de red. Probá de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-3 md:grid-cols-[1fr_1fr]">
      <label className="block">
        <span className="text-xs font-bold text-ink-600">Estado</span>
        <select
          value={nextStatus}
          onChange={(e) => setNextStatus(e.target.value)}
          className="mt-1 w-full rounded-xl border border-ink-200 bg-surface px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-400"
        >
          {ADMIN_ORDER_STATUSES.map((s) => (
            <option key={s.id} value={s.id}>{s.label} ({s.id})</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-xs font-bold text-ink-600">Código de seguimiento</span>
        <input
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
          placeholder="Ej. Andreani 123456…"
          className="mt-1 w-full rounded-xl border border-ink-200 bg-surface px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-400"
        />
      </label>
      <label className="block md:col-span-2">
        <span className="text-xs font-bold text-ink-600">Nota interna (queda en el historial)</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ej. comprobante recibido por WhatsApp"
          className="mt-1 w-full rounded-xl border border-ink-200 bg-surface px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-400"
        />
      </label>
      <div className="flex items-center gap-3 md:col-span-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-bold text-white transition-[background-color,color,border-color,box-shadow,opacity] duration-150 hover:bg-brand-800 disabled:cursor-not-allowed"
        >
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
        {saved ? <p className="text-xs font-bold text-emerald-700">{saved}</p> : null}
        {error ? <p role="alert" className="text-xs font-semibold text-red-600">{error}</p> : null}
      </div>
    </form>
  );
}
