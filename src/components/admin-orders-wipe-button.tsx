"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Borra todos los pedidos y pagos. Pide escribir BORRAR para confirmar. */
export function AdminOrdersWipeButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function wipe() {
    const answer = window.prompt(
      "Se van a borrar TODOS los pedidos y pagos, y el stock que tenían reservado vuelve a la tienda. No se puede deshacer.\n\nEscribí BORRAR para confirmar.",
    );
    if (answer === null) return;
    if (answer.trim().toUpperCase() !== "BORRAR") {
      setError("No se borró nada: había que escribir BORRAR.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: "BORRAR" }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setError(data.error ?? "No se pudo borrar.");
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
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={wipe}
        disabled={pending}
        className="inline-flex h-10 items-center rounded-full border border-adm-red/40 bg-adm-red/[0.06] px-4 text-sm font-semibold text-red-600 transition-[background-color,color,border-color,box-shadow,opacity] duration-150 hover:bg-adm-red/[0.14] disabled:cursor-not-allowed"
      >
        {pending ? "Borrando…" : "Borrar todos"}
      </button>
      {error && (
        <span className="text-xs text-red-700" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
