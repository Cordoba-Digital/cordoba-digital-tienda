"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { safeAdminPath } from "@/lib/customer-session";

const ERRORS: Record<string, string> = {
  email:
    "Ese email de Google no tiene acceso al panel. Pedile a un dueño que te agregue en Accesos.",
  oauth: "No se pudo completar el ingreso con Google. Probá de nuevo.",
  config: "El ingreso con Google no está configurado en el servidor.",
  bloqueado: "Demasiados intentos fallidos. Probá de nuevo en unos minutos.",
};

export function AdminLoginForm({
  google,
  password: passwordEnabled,
}: {
  google: boolean;
  password: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeAdminPath(params.get("next"));
  const [password, setPassword] = useState("");
  const [error, setError] = useState(ERRORS[params.get("error") ?? ""] ?? "");
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, remember }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "No se pudo iniciar sesión.");
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError("Error de red. Probá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="admin-card p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-700">
          Admin
        </p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-ink-900">
          Ingresar al panel
        </h1>
        <p className="mt-1 text-sm text-ink-500">Uso interno del local.</p>
        {google || passwordEnabled ? (
          <label className="mt-5 flex cursor-pointer items-start gap-2.5 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-brand-700"
            />
            <span>
              <span className="font-semibold text-ink-900">Recordarme en este dispositivo</span>
              <span className="block text-xs text-ink-500">
                No vas a tener que volver a ingresar por 30 días. Destildalo en una computadora compartida.
              </span>
            </span>
          </label>
        ) : null}
        {google ? (
          <a
            href={`/api/auth/google/start?admin=1${remember ? "&remember=1" : ""}&next=${encodeURIComponent(next)}`}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-ink-200 bg-surface px-4 py-3 text-sm font-bold text-ink-900 transition-[background-color,color,border-color,box-shadow,opacity] duration-150 hover:border-ink-400"
          >
            <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
              <path
                fill="#FFC107"
                d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
              />
              <path
                fill="#FF3D00"
                d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
              />
              <path
                fill="#4CAF50"
                d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
              />
              <path
                fill="#1976D2"
                d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
              />
            </svg>
            Ingresar con Google
          </a>
        ) : null}
        {google && passwordEnabled ? (
          <p className="mt-4 text-center text-[11px] font-bold uppercase tracking-wide text-ink-400">
            o con la clave de administrador
          </p>
        ) : null}
        {!google && !passwordEnabled ? (
          <p className="mt-5 text-sm font-semibold text-red-600">
            El panel no tiene ningún ingreso configurado. Definí ADMIN_EMAILS
            (con Google) o ADMIN_PASSWORD en el servidor.
          </p>
        ) : null}
        {passwordEnabled ? (
          <form
            onSubmit={submit}
            className={`${google ? "mt-3" : "mt-5"} space-y-3`}
          >
            <label className="block">
              <span className="text-xs font-bold text-ink-600">Clave de administrador</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="mt-1 w-full rounded-xl border border-ink-200 bg-surface px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-400"
              />
            </label>
            {error ? (
              <p role="alert" className="text-xs font-semibold text-red-600">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white transition-[background-color,color,border-color,box-shadow,opacity] duration-150 hover:bg-brand-800 disabled:cursor-not-allowed"
            >
              {loading ? "Ingresando…" : "Ingresar"}
            </button>
          </form>
        ) : error ? (
          <p role="alert" className="mt-3 text-xs font-semibold text-red-600">
            {error}
          </p>
        ) : null}
        <Link
          href="/"
          className="mt-4 block text-center text-xs font-semibold text-ink-500 hover:text-brand-700"
        >
          ← Volver a la tienda
        </Link>
      </div>
    </div>
  );
}
