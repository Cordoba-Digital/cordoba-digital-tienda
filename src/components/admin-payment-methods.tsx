"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Account = { number: string; alias: string; holder: string; cuit: string };

const when = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Cordoba",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const FIELDS: { key: keyof Account; label: string; hint: string; inputMode?: "numeric" }[] = [
  { key: "holder", label: "Titular", hint: "Como figura en la cuenta. El cliente lo ve antes de transferir." },
  { key: "number", label: "CBU o CVU", hint: "22 números. Se revisa que sea un número válido.", inputMode: "numeric" },
  { key: "alias", label: "Alias", hint: "Entre 6 y 20 caracteres." },
  { key: "cuit", label: "CUIT o CUIL (opcional)", hint: "11 números.", inputMode: "numeric" },
];

export function AdminPaymentMethods({
  initial,
  source,
  updatedBy,
  updatedAt,
  canEdit,
  mailReady,
}: {
  initial: Account | null;
  source: "panel" | "vercel" | "vacio";
  updatedBy: string | null;
  updatedAt: string | null;
  canEdit: boolean;
  mailReady: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Account>(initial ?? { number: "", alias: "", holder: "", cuit: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/admin/payment-methods", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "No se pudo guardar.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Error de red. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <form
        className="admin-card max-w-2xl space-y-4 p-4 sm:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (window.confirm("¿Cambiar la cuenta a la que transfieren los clientes? Revisá bien los datos: los próximos pagos van a llegar ahí.")) {
            void save();
          }
        }}
      >
        <div>
          <h2 className="text-base font-semibold text-adm-fg">Transferencia bancaria</h2>
          <p className="mt-1 text-xs text-ink-500">
            {source === "panel" && updatedAt
              ? `Último cambio: ${updatedBy ?? "—"}, el ${when.format(new Date(updatedAt))}.`
              : source === "vercel"
                ? "Hoy estos datos salen de Vercel. Al guardar acá, pasan a manejarse desde el panel."
                : "Todavía no hay cuenta cargada: el cliente ve un aviso para pedir los datos por WhatsApp."}
          </p>
        </div>
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="text-sm font-semibold text-ink-900">{f.label}</span>
            <input
              value={form[f.key]}
              onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
              disabled={!canEdit || busy}
              inputMode={f.inputMode}
              autoComplete="off"
              spellCheck={false}
              className="mt-1 h-10 w-full border border-ink-200 bg-surface px-3 text-sm text-ink-900 outline-none focus:border-ink-400 disabled:bg-ink-50 disabled:text-ink-600"
            />
            <span className="mt-1 block text-xs text-ink-500">{f.hint}</span>
          </label>
        ))}
        {canEdit ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="h-10 bg-ink-900 px-5 text-sm font-bold text-white transition-[background-color,color,border-color,box-shadow,opacity] duration-150 hover:bg-ink-700 disabled:cursor-default disabled:bg-ink-300"
            >
              {busy ? "Guardando…" : "Guardar cuenta"}
            </button>
            {saved ? <span className="text-sm font-semibold text-emerald-700">Guardado. Vale desde el próximo pedido.</span> : null}
          </div>
        ) : (
          <p className="text-sm text-ink-600">Solo los dueños pueden cambiar la cuenta de cobro.</p>
        )}
        {error ? <p role="alert" className="text-sm font-semibold text-red-600">{error}</p> : null}
      </form>
      <p className="max-w-2xl text-xs text-ink-500">
        Cada cambio queda en Actividad con el dato anterior
        {mailReady ? " y llega un aviso a consultas@cordobadigital.net." : ". El aviso por email se activa cuando esté configurado el correo de salida (SMTP)."}
      </p>
    </div>
  );
}
