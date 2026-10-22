"use client";

import { useState } from "react";

type Status = { type: "idle" | "loading" | "success" | "error"; message?: string; code?: string };

export function ArrepentimientoForm() {
  const [status, setStatus] = useState<Status>({ type: "idle" });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ type: "loading" });

    // Después del `await` React ya soltó `currentTarget`: se guarda antes.
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const body = {
      nombre: String(form.get("nombre") ?? ""),
      email: String(form.get("email") ?? ""),
      numeroPedido: String(form.get("numeroPedido") ?? ""),
      telefono: String(form.get("telefono") ?? ""),
      fechaCompra: String(form.get("fechaCompra") ?? ""),
      producto: String(form.get("producto") ?? ""),
      comentarios: String(form.get("comentarios") ?? ""),
    };

    try {
      const res = await fetch("/api/arrepentimiento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const firstError = data.errors ? Object.values(data.errors as Record<string, string>)[0] : null;
        setStatus({ type: "error", message: firstError ?? data.error ?? "Revisá los datos e intentá de nuevo." });
        return;
      }
      setStatus({
        type: "success",
        code: data.code,
        message: data.emailSent
          ? "Te mandamos este código por email. Te vamos a contactar dentro de las 24 horas hábiles."
          : "Guardá este código. Te vamos a contactar dentro de las 24 horas hábiles.",
      });
      formElement.reset();
    } catch {
      setStatus({ type: "error", message: "No pudimos enviar la solicitud. Probá de nuevo." });
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-semibold text-ink-800">
        Nombre *
        <input name="nombre" required className="mt-1 h-10 w-full rounded-xl border border-ink-200 bg-surface px-3" />
      </label>
      <label className="block text-sm font-semibold text-ink-800">
        Email *
        <input name="email" type="email" required className="mt-1 h-10 w-full rounded-xl border border-ink-200 bg-surface px-3" />
      </label>
      <label className="block text-sm font-semibold text-ink-800">
        Número de Pedido
        <input name="numeroPedido" className="mt-1 h-10 w-full rounded-xl border border-ink-200 bg-surface px-3" />
      </label>
      <label className="block text-sm font-semibold text-ink-800">
        Teléfono de contacto *
        <input name="telefono" required className="mt-1 h-10 w-full rounded-xl border border-ink-200 bg-surface px-3" />
      </label>
      <label className="block text-sm font-semibold text-ink-800">
        Fecha de Compra *
        <input name="fechaCompra" type="date" required className="mt-1 h-10 w-full rounded-xl border border-ink-200 bg-surface px-3" />
      </label>
      <label className="block text-sm font-semibold text-ink-800">
        Producto *
        <input name="producto" required className="mt-1 h-10 w-full rounded-xl border border-ink-200 bg-surface px-3" />
      </label>
      <label className="block text-sm font-semibold text-ink-800">
        Comentarios
        <textarea name="comentarios" rows={4} className="mt-1 w-full rounded-xl border border-ink-200 bg-surface px-3 py-2" />
      </label>

      {status.type === "success" && status.code ? (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          <p className="font-bold">Recibimos tu solicitud.</p>
          <p className="mt-1">
            Código de trámite: <strong className="font-mono text-lg">{status.code}</strong>
          </p>
          <p className="mt-1 text-sm">{status.message}</p>
        </div>
      ) : status.message ? (
        <p role="alert" className={status.type === "success" ? "text-emerald-700" : "text-rose-600"}>{status.message}</p>
      ) : null}

      <button type="submit" disabled={status.type === "loading"} className="rounded-xl bg-brand-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-400 disabled:opacity-60">
        {status.type === "loading" ? "Enviando..." : "Enviar Solicitud de Arrepentimiento"}
      </button>
    </form>
  );
}
