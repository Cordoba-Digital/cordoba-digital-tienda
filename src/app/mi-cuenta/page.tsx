import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Pill } from "@/components/ui";
import { isAllowedAdminEmail } from "@/lib/admin-access";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { money } from "@/lib/format";
import { getOrdersByEmail } from "@/lib/queries";
import { statusLabel } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Mi cuenta",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MiCuentaPage() {
  const customer = await getCurrentCustomer();
  if (!customer) {
    redirect("/ingresar?next=/mi-cuenta");
  }
  const [orders, isAdmin] = await Promise.all([getOrdersByEmail(customer.email), isAllowedAdminEmail(customer.email)]);

  return (
    <div className="container-xl space-y-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {customer.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={customer.avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-100 text-xl font-black text-brand-700">
              {customer.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-700">Mi cuenta</p>
            <h1 className="text-2xl font-black tracking-tight text-ink-900">Hola, {customer.name.split(" ")[0]}</h1>
            <p className="text-xs text-ink-500">{customer.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <Link
              href="/admin"
              className="rounded-xl bg-ink-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-ink-700"
            >
              Panel admin
            </Link>
          ) : null}
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="rounded-xl border border-ink-200 px-4 py-2 text-xs font-bold text-ink-600 transition hover:border-rose-300 hover:text-rose-600"
            >
              Salir
            </button>
          </form>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-extrabold text-ink-900">Mis pedidos ({orders.length})</h2>
        {orders.length === 0 ? (
          <div className="card-surface p-6 text-center">
            <p className="text-sm font-semibold text-ink-700">Todavía no tenés pedidos con este email.</p>
            <p className="mt-1 text-xs text-ink-500">
              Si compraste como invitado con otro email, esos pedidos no aparecen acá.
            </p>
            <Link
              href="/productos"
              className="mt-4 inline-block rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-800"
            >
              Ver el catálogo
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {orders.map((o) => (
              <li key={o.id} className="card-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Link href={`/pedido/${o.code}`} className="font-bold text-brand-700 hover:underline">
                      {o.code}
                    </Link>
                    <p className="text-xs text-ink-500">
                      {o.createdAt.toLocaleDateString("es-AR")} · {o.itemsCount} {o.itemsCount === 1 ? "ítem" : "ítems"}
                      {o.deliveryLabel ? ` · ${o.deliveryLabel}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-black text-ink-900">{money(o.total)}</span>
                    <Pill tone="neutral">{statusLabel(o.status)}</Pill>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
