import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";

import { ADMIN_COOKIE, verifyAdminSessionValue } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Panel" },
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/pagos", label: "Pagos" },
  { href: "/admin/usuarios", label: "Usuarios" },
  { href: "/admin/productos", label: "Productos" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // El nav solo existe con sesión válida: en /admin/login (sin sesión) no se
  // muestra nada interno, ni siquiera los nombres de las secciones.
  const jar = await cookies();
  const authed = await verifyAdminSessionValue(jar.get(ADMIN_COOKIE)?.value);
  return (
    <div className="container-xl py-8">
      {authed && (
        <nav className="mb-6 flex flex-wrap gap-2" aria-label="Administración">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl border border-ink-200 bg-surface px-4 py-2 text-sm font-bold text-ink-700 transition hover:border-brand-300 hover:text-brand-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
      {children}
    </div>
  );
}
