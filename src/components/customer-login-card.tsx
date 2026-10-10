import Link from "next/link";
import { AlertCircle, ArrowRight, Package, UserRound } from "lucide-react";

/**
 * Tarjeta de ingreso de clientes. Diseño tomado del login de EasyUI
 * (Surajmaurya1/easyui/login), adaptado a la tienda: el ingreso es solo con
 * Google (no hay contraseñas), y donde el original ofrecía GitHub y el form de
 * email + contraseña va el seguimiento de un pedido sin cuenta.
 */
export function CustomerLoginCard({ googleHref, error }: { googleHref: string; error: string | null }) {
  return (
    <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-ink-200 bg-surface p-6 shadow-[0_20px_50px_rgba(20,22,28,0.10)] sm:p-8">
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-24 w-3/4 -translate-x-1/2 bg-gradient-to-b from-brand-200/50 to-transparent blur-2xl"
        aria-hidden
      />

      <div className="relative z-10 mb-6 flex flex-col items-center text-center">
        <div className="mb-3.5 flex h-10 w-10 items-center justify-center rounded-xl border border-ink-200 bg-surface text-ink-900 shadow-sm">
          <UserRound className="h-5 w-5" aria-hidden />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl">Ingresá a tu cuenta</h1>
        <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-ink-500 sm:text-sm">
          Un click con Google y listo, sin contraseñas. Vas a ver tus pedidos, incluidos los que hiciste como invitado
          con el mismo email.
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          className="relative z-10 mb-5 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="relative z-10">
        <a
          href={googleHref}
          className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-ink-200 bg-surface px-4 py-3 text-sm font-bold text-ink-900 shadow-sm transition-colors duration-150 hover:border-ink-400 hover:bg-ink-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
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
          Continuar con Google
        </a>
        <p className="mt-2.5 text-center text-[11px] text-ink-500">
          Tu sesión queda abierta 30 días en este dispositivo.
        </p>

        <div className="relative my-6 flex items-center justify-center">
          <div className="w-full border-t border-ink-200" />
          <span className="absolute bg-surface px-3 font-mono text-[10px] uppercase tracking-widest text-ink-500">
            O seguí un pedido sin cuenta
          </span>
        </div>

        <form action="/seguimiento" method="get" className="space-y-3">
          <label htmlFor="codigo" className="block text-xs font-semibold text-ink-700">
            Código de pedido
          </label>
          <div className="relative">
            <Package
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
              aria-hidden
            />
            <input
              id="codigo"
              name="codigo"
              required
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="Lo encontrás en el email de compra"
              className="w-full rounded-xl border border-ink-200 bg-surface py-3 pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-400 transition-colors focus:border-brand-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-ink-200 bg-surface px-4 py-3 text-sm font-bold text-ink-900 shadow-sm transition-colors duration-150 hover:border-ink-400 hover:bg-ink-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
          >
            Ver mi pedido
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </form>
      </div>

      <div className="relative z-10 mt-6 border-t border-ink-200 pt-4 text-center text-xs text-ink-500">
        ¿Todavía no compraste?{" "}
        <Link href="/productos" className="font-bold text-brand-700 hover:underline">
          Ver el catálogo
        </Link>
      </div>
    </div>
  );
}
