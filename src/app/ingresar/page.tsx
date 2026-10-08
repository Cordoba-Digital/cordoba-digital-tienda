import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentCustomer } from "@/lib/customer-auth";

export const metadata: Metadata = {
  title: "Ingresar a tu cuenta",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  config: "El ingreso con Google todavía no está configurado en este servidor.",
  oauth: "No pudimos completar el ingreso con Google. Probá de nuevo.",
  disabled: "Esta cuenta está deshabilitada. Escribinos por WhatsApp y lo revisamos.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function IngresarPage({ searchParams }: { searchParams: SearchParams }) {
  const customer = await getCurrentCustomer();
  const sp = await searchParams;
  const first = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));
  const next = first(sp.next);
  if (customer) {
    redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/mi-cuenta");
  }
  const error = ERRORS[first(sp.error)] ?? null;
  const startHref = `/api/auth/google/start${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <div className="container-xl py-12">
      <div className="mx-auto max-w-md">
        <div className="card-surface p-6 text-center sm:p-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-700">Tu cuenta</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-ink-900">Ingresá con Google</h1>
          <p className="mt-2 text-sm text-ink-500">
            Un click y listo: sin contraseñas. Vas a ver tu historial de pedidos, incluidos los que hiciste como
            invitado con el mismo email.
          </p>
          {error ? (
            <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {error}
            </p>
          ) : null}
          <a
            href={startHref}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl bg-ink-900 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-ink-800"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.5h6.5c0 1.1-.7 2.7-2.2 3.8l-.1.3 3.2 2.5.2.1c2-1.9 3.9-4.6 3.9-8.9z"
              />
              <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.8-5l-.2.1-3.1 2.4-.1.2C3.8 21.3 7.6 24 12 24z" />
              <path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-.1-.2-3.1-2.4-.1.1C.7 9.4 0 10.6 0 12s.7 2.6 1.9 3.9l3.3-1.5z" />
              <path fill="#EA4335" d="M12 4.6c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.6 0 3.8 2.7 1.9 6.1l3.3 3.5c1-2.9 3.7-5 6.8-5z" />
            </svg>
            Continuar con Google
          </a>
          <p className="mt-4 text-xs text-ink-500">
            ¿Todavía no compraste?{" "}
            <Link href="/productos" className="font-bold text-brand-700 hover:underline">
              Ver el catálogo
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
