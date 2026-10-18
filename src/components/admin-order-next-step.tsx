"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { NextStep } from "@/lib/admin-order-helpers";

async function patchOrder(code: string, body: Record<string, string>): Promise<string | null> {
  try {
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(code)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    return res.ok && json.ok ? null : (json.error ?? "No se pudo guardar.");
  } catch {
    return "Error de red. Probá de nuevo.";
  }
}

/**
 * El paso que sigue para el pedido, con un solo botón: cobrar, preparar,
 * despachar o entregar. Lo demás (volver atrás, notas) queda en "Cambiar a mano".
 */
export function AdminOrderNextStep({
  code,
  step,
  trackingCode,
  canCancel,
  notifiesCustomer,
}: {
  code: string;
  step: NextStep;
  trackingCode: string;
  canCancel: boolean;
  /** Si el interruptor "Avisar al cliente por email" está prendido. */
  notifiesCustomer: boolean;
}) {
  const router = useRouter();
  const [tracking, setTracking] = useState(trackingCode);
  const [busy, setBusy] = useState<"" | "next" | "cancel">("");
  const [error, setError] = useState("");

  async function advance(e: React.FormEvent) {
    e.preventDefault();
    if (!step.to) return;
    setBusy("next");
    setError("");
    const body: Record<string, string> = { status: step.to };
    if (step.asksTracking) body.trackingCode = tracking;
    const failed = await patchOrder(code, body);
    setBusy("");
    if (failed) setError(failed);
    else router.refresh();
  }

  async function cancel() {
    if (!window.confirm(`¿Cancelar el pedido ${code}? El stock y el cupón vuelven a la tienda.`)) return;
    setBusy("cancel");
    setError("");
    const failed = await patchOrder(code, { status: "cancelado", note: "Cancelado desde el panel." });
    setBusy("");
    if (failed) setError(failed);
    else router.refresh();
  }

  return (
    <form onSubmit={advance} className="space-y-3">
      <p className="text-sm text-ink-700">{step.hint}</p>
      {step.to && step.asksTracking ? (
        <label className="block max-w-sm">
          <span className="text-xs font-semibold text-ink-600">Número de seguimiento (opcional)</span>
          <input
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            placeholder="Ej. 360002345678"
            className="mt-1 w-full rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-900 outline-none focus:border-ink-400"
          />
        </label>
      ) : null}
      {step.to || canCancel ? (
        <div className="flex flex-wrap items-center gap-2">
          {step.to ? (
            <button
              type="submit"
              disabled={busy !== ""}
              className="rounded-lg bg-ink-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === "next" ? "Guardando…" : step.button}
            </button>
          ) : null}
          {canCancel ? (
            <button
              type="button"
              onClick={cancel}
              disabled={busy !== ""}
              className="rounded-lg px-3 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === "cancel" ? "Cancelando…" : "Cancelar pedido"}
            </button>
          ) : null}
        </div>
      ) : null}
      {step.to ? (
        <p className="text-xs text-ink-500">
          {notifiesCustomer
            ? "Al cliente le llega un email con el cambio."
            : "El cliente no recibe email (el aviso está apagado en Automatizaciones)."}
        </p>
      ) : null}
      {error ? <p role="alert" className="text-sm font-semibold text-red-600">{error}</p> : null}
    </form>
  );
}
