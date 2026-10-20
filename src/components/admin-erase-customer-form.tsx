"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Supresión de datos a pedido del cliente: borra nombre, contacto y dirección
 * de sus pedidos, sus arrepentimientos, el newsletter y la cuenta. Sirve
 * también para quien compró como invitado y no tiene cuenta.
 */
export function AdminEraseCustomerForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function erase(event: React.FormEvent) {
    event.preventDefault();
    const target = email.trim();
    if (!target) return;
    if (
      !window.confirm(
        `¿Borrar los datos personales de ${target}? Se borran nombre, email, teléfono, DNI y dirección de sus pedidos, ` +
          "sus arrepentimientos, el newsletter y su cuenta. Los pedidos quedan con sus montos. No se puede deshacer.",
      )
    )
      return;
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/users/suprimir", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: target }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; orders?: number };
      if (!data.ok) {
        setMessage({ tone: "error", text: data.error ?? "No se pudo borrar." });
        return;
      }
      const pedidos = data.orders ?? 0;
      setMessage({
        tone: "ok",
        text: `Listo: se borraron los datos de ${target} (${pedidos} pedido${pedidos === 1 ? "" : "s"}).`,
      });
      setEmail("");
      router.refresh();
    } catch {
      setMessage({ tone: "error", text: "Error de red. Probá de nuevo." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={erase} className="admin-card space-y-3 p-4">
      <div>
        <p className="text-sm font-bold text-ink-900">Borrar datos de un cliente</p>
        <p className="mt-1 text-sm text-ink-500">
          Cuando un cliente pide que borremos sus datos. Funciona aunque haya comprado sin cuenta. Solo dueños.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email del cliente"
          aria-label="Email del cliente"
          className="min-w-52 flex-1 border border-ink-200 bg-surface px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending || !email.trim()}
          className="rounded-xl border border-red-600 px-4 py-2 text-sm font-bold text-red-600 transition-[background-color,color,border-color,box-shadow,opacity] duration-150 hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Borrando…" : "Borrar datos"}
        </button>
      </div>
      {message && (
        <p className={`text-sm ${message.tone === "ok" ? "text-green-700" : "text-red-700"}`} role={message.tone === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      )}
    </form>
  );
}
