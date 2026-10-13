"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type ErrorView = {
  fingerprint: string;
  message: string;
  stack: string;
  where: string;
  route: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  resolved: boolean;
};

export function AdminErrorList({ rows }: { rows: ErrorView[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const open = rows.filter((r) => !r.resolved).length;

  async function resolve(fingerprint: string) {
    setBusy(fingerprint);
    setError("");
    try {
      const res = await fetch("/api/admin/errors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fingerprint }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "No se pudo guardar.");
        return;
      }
      router.refresh();
    } catch {
      setError("Error de red. Probá de nuevo.");
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) {
    return <p className="admin-card px-4 py-8 text-center text-sm text-ink-500">Sin errores registrados.</p>;
  }

  return (
    <div className="space-y-3">
      {error ? <p role="alert" className="text-sm font-semibold text-red-600">{error}</p> : null}
      {open > 1 ? (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void resolve("todos")}
          className="border border-ink-300 px-3 py-1.5 text-xs font-bold text-ink-700 hover:border-ink-500 disabled:cursor-default"
        >
          {busy === "todos" ? "Guardando…" : `Marcar los ${open} como resueltos`}
        </button>
      ) : null}
      <ul className="admin-card divide-y divide-ink-100">
        {rows.map((row) => (
          <li key={row.fingerprint} className={`p-4 ${row.resolved ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-bold text-ink-900">{row.message}</p>
                <p className="mt-0.5 break-all font-mono text-xs text-ink-500">{row.where}</p>
                <p className="mt-1 text-xs text-ink-500">
                  {row.count === 1 ? "Pasó 1 vez" : `Pasó ${row.count} veces`} · última {row.lastSeen} · primera {row.firstSeen}
                </p>
              </div>
              {row.resolved ? (
                <span className="bg-ink-300 px-2.5 py-1 text-[11px] font-bold text-ink-900">Resuelto</span>
              ) : (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void resolve(row.fingerprint)}
                  className="border border-ink-900 px-3 py-1.5 text-xs font-bold text-ink-900 hover:bg-ink-900 hover:text-white disabled:cursor-default"
                >
                  {busy === row.fingerprint ? "…" : "Marcar resuelto"}
                </button>
              )}
            </div>
            {row.stack ? (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-semibold text-ink-600">Detalle técnico</summary>
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all bg-ink-50 p-3 font-mono text-[11px] text-ink-700">
                  {row.route ? `${row.route}\n\n` : ""}
                  {row.stack}
                </pre>
              </details>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
