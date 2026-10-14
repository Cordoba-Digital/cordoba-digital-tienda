import type { Metadata } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { AdminSidebar } from "@/components/admin-sidebar";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { readAdminSession } from "@/lib/admin-session";
import { countRecentArrepentimientos } from "@/lib/admin-arrepentimientos";
import { countPendingOrders } from "@/lib/admin-stats";
import { countOpenErrors } from "@/lib/error-log";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // La barra lateral solo existe con sesión válida: en /admin/login (sin
  // sesión) no se muestra nada interno, ni siquiera los nombres de las secciones.
  const jar = await cookies();
  const session = await readAdminSession(jar.get(ADMIN_COOKIE)?.value);
  if (!session) {
    return <div className="admin-shell grid min-h-screen place-items-center px-4 py-10">{children}</div>;
  }
  return (
    <div className="min-h-screen">
      <AdminSidebar
        badges={{
          "/admin/pedidos": await countPendingOrders(),
          "/admin/arrepentimientos": await countRecentArrepentimientos(),
          "/admin/errores": await countOpenErrors(),
        }}
        who={session.email}
      />
      {/* El contenido acompaña el ancho: más aire en monitores grandes sin que las tablas queden angostas. */}
      <div className="md:pl-[72px] lg:pl-60">
        <main className="admin-shell mx-auto max-w-6xl px-4 py-5 sm:px-6 md:py-6 lg:px-8 lg:py-8 xl:max-w-7xl 2xl:max-w-[1440px] 2xl:px-10">{children}</main>
      </div>
    </div>
  );
}
