"use client";

import { useState } from "react";

import type { AutomationId } from "@/lib/automations";

export type AutomationView = {
  id: AutomationId;
  label: string;
  description: string;
  enabled: boolean;
  warning: string | null;
};

export function AdminAutomations({ rows }: { rows: AutomationView[] }) {
  const [state, setState] = useState<Record<string, boolean>>(() => Object.fromEntries(rows.map((r) => [r.id, r.enabled])));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function toggle(id: AutomationId) {
    const enabled = !state[id];
    setBusy(id);
    setError("");
    try {
      const res = await fetch("/api/admin/automations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; automations?: Record<string, boolean> };
      if (!res.ok || !data.ok || !data.automations) {
        setError(data.error ?? "No se pudo guardar.");
        return;
      }
      setState(data.automations);
    } catch {
      setError("Error de red. Probá de nuevo.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {error ? <p role="alert" className="text-sm font-semibold text-red-600">{error}</p> : null}
      <ul className="admin-card divide-y divide-ink-100">
        {rows.map((row) => {
          const on = state[row.id];
          return (
            <li key={row.id} className="flex items-start gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p id={`auto-${row.id}`} className="text-sm font-bold text-ink-900">{row.label}</p>
                <p className="mt-0.5 text-sm text-ink-500">{row.description}</p>
                {row.warning ? <p className="mt-2 text-xs font-semibold text-amber-700">{row.warning}</p> : null}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-labelledby={`auto-${row.id}`}
                disabled={busy !== null}
                onClick={() => void toggle(row.id)}
                className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors duration-150 disabled:cursor-default disabled:opacity-60 ${on ? "bg-emerald-600" : "bg-ink-300"}`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-150 ${on ? "translate-x-5" : ""}`}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
