"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Archivar (DELETE) o restaurar (POST …/restore) un producto. */
export function AdminProductArchiveButton({ slug, mode }: { slug: string; mode: "archive" | "restore" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    if (mode === "archive" && !window.confirm("¿Archivar este producto? Deja de verse en la tienda y podés restaurarlo después.")) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const base = `/api/admin/products/${encodeURIComponent(slug)}`;
      const res = await fetch(mode === "archive" ? base : `${base}/restore`, { method: mode === "archive" ? "DELETE" : "POST" });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "No se pudo completar.");
        return;
      }
      if (mode === "archive") router.push("/admin/productos/archivados");
      else router.refresh();
    } catch {
      setError("Error de red.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className={
          mode === "archive"
            ? "rounded-xl border border-red-600 px-4 py-2 text-xs font-bold text-red-600 transition hover:bg-red-600 hover:text-white disabled:cursor-not-allowed"
            : "rounded-xl border border-ink-200 px-4 py-2 text-xs font-bold text-ink-700 transition hover:border-brand-300 disabled:opacity-40"
        }
      >
        {busy ? "…" : mode === "archive" ? "Archivar" : "Restaurar"}
      </button>
      {error ? <span role="alert" className="text-xs font-semibold text-red-600">{error}</span> : null}
    </span>
  );
}
