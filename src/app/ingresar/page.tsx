import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CustomerLoginCard } from "@/components/customer-login-card";
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
      <CustomerLoginCard googleHref={startHref} error={error} />
    </div>
  );
}
