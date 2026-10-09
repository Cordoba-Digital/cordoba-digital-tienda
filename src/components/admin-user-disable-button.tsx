"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminUserDisableButton({ id, disabled }: { id: number; disabled: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !disabled;
    if (!window.confirm(next ? "¿Bloquear esta cuenta? No podrá ingresar." : "¿Desbloquear esta cuenta?")) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled: next }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setError(data.error ?? "No se pudo actualizar.");
        return;
      }
      router.refresh();
    } catch {
      setError("Error de red. Probá de nuevo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className="rounded-xl border border-ink-200 px-4 py-2 text-sm font-bold text-ink-700 transition hover:border-red-400 hover:text-red-700 disabled:opacity-50"
      >
        {pending ? "Guardando…" : disabled ? "Desbloquear cuenta" : "Bloquear cuenta"}
      </button>
      {error && (
        <span className="text-xs text-red-700" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
