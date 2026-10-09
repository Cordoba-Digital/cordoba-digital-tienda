"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminUserDeleteButton({ id, label }: { id: number; label: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (
      !window.confirm(
        `¿Eliminar la cuenta de ${label}? Se borra la cuenta y sus sesiones; los pedidos quedan. No se puede deshacer.`,
      )
    )
      return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setError(data.error ?? "No se pudo eliminar.");
        return;
      }
      router.replace("/admin/usuarios");
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
        onClick={remove}
        disabled={pending}
        className="rounded-xl border border-red-600 px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-600 hover:text-white disabled:cursor-not-allowed"
      >
        {pending ? "Eliminando…" : "Eliminar cuenta"}
      </button>
      {error && (
        <span className="text-xs text-red-700" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
