"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Row = { email: string; addedBy: string; addedAt: string; owner: boolean };

const when = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Cordoba", day: "2-digit", month: "2-digit", year: "numeric" });

export function AdminAccessManager({ rows, canManage, me }: { rows: Row[]; canManage: boolean; me: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function send(method: "POST" | "DELETE", target: string) {
    setBusy(target);
    setError("");
    try {
      const res = await fetch("/api/admin/access", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: target }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "No se pudo guardar.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Error de red. Probá de nuevo.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {canManage ? (
        <form
          className="admin-card flex flex-col gap-2 p-4 sm:flex-row sm:items-center"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await send("POST", email.trim())) setEmail("");
          }}
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@gmail.com"
            aria-label="Email del nuevo admin"
            required
            className="h-10 min-w-0 flex-1 border border-ink-200 bg-surface px-3 text-sm text-ink-900 outline-none focus:border-ink-400"
          />
          <button
            type="submit"
            disabled={busy !== null || !email.trim()}
            className="h-10 bg-ink-900 px-5 text-sm font-bold text-white transition hover:bg-ink-700 disabled:cursor-default disabled:bg-ink-300"
          >
            {busy === email.trim() ? "Agregando…" : "Dar acceso"}
          </button>
        </form>
      ) : (
        <p className="admin-card p-4 text-sm text-ink-600">Solo los dueños pueden agregar o quitar accesos.</p>
      )}
      {error ? <p role="alert" className="text-sm font-semibold text-red-600">{error}</p> : null}

      <div className="admin-table">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-500">Todavía no hay admins. Cargá `ADMIN_EMAILS` en Vercel.</p>
        ) : (
          <ul>
            {rows.map((r) => (
              <li key={r.email} className="flex flex-wrap items-center gap-3 border-b border-ink-100 px-4 py-3 last:border-0">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink-900 text-sm font-black text-white" aria-hidden>
                  {r.email.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-900">
                    {r.email}
                    {r.email === me ? <span className="ml-2 text-xs font-normal text-ink-500">(vos)</span> : null}
                  </p>
                  <p className="text-xs text-ink-500">
                    {r.owner ? "Dueño · se cambia en Vercel" : `Agregado por ${r.addedBy} el ${when.format(new Date(r.addedAt))}`}
                  </p>
                </div>
                <span className={`px-2.5 py-1 text-[11px] font-bold ${r.owner ? "bg-brand-700 text-white" : "bg-ink-700 text-white"}`}>
                  {r.owner ? "Dueño" : "Admin"}
                </span>
                {canManage && !r.owner ? (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => {
                      if (window.confirm(`¿Quitar el acceso de ${r.email}? Se le cierra la sesión del panel.`)) void send("DELETE", r.email);
                    }}
                    className="border border-red-600 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-600 hover:text-white disabled:cursor-default"
                  >
                    {busy === r.email ? "Quitando…" : "Quitar"}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
