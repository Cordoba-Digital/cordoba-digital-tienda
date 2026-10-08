import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Panel" },
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/productos", label: "Productos" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="container-xl py-8">
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
      {children}
    </div>
  );
}
