import type { Metadata } from "next";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { ADMIN_NAV_COOKIE, ADMIN_THEME_COOKIE } from "@/components/admin-nav-items";
import { AdminFrame } from "@/components/admin-sidebar";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { readAdminSession } from "@/lib/admin-session";
import { countRecentArrepentimientos } from "@/lib/admin-arrepentimientos";
import { countPendingOrders } from "@/lib/admin-stats";
import { countOpenErrors } from "@/lib/error-log";

/* Geist y Geist Mono (licencia OFL, ver public/fonts/GEIST-OFL.txt): solo el
   panel las usa, la tienda sigue con Plus Jakarta Sans. */
const geist = localFont({
  src: "../../../public/fonts/geist-latin.woff2",
  weight: "100 900",
  variable: "--font-geist",
  display: "swap",
});
const geistMono = localFont({
  src: "../../../public/fonts/geist-mono-latin.woff2",
  weight: "100 900",
  variable: "--font-geist-mono",
  display: "swap",
});
const theme = `admin-theme ${geist.variable} ${geistMono.variable}`;

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
  const tema = jar.get(ADMIN_THEME_COOKIE)?.value === "oscuro" ? "oscuro" : "claro";
  if (!session) {
    return <div data-tema={tema} className={`${theme} admin-shell admin-radios grid min-h-dvh place-items-center px-4 py-10`}>{children}</div>;
  }
  return (
    <div data-tema={tema} className={`${theme} admin-radios`}>
      <AdminFrame
        badges={{
          "/admin/pedidos": await countPendingOrders(),
          "/admin/arrepentimientos": await countRecentArrepentimientos(),
          "/admin/errores": await countOpenErrors(),
        }}
        who={session.email}
        compact={jar.get(ADMIN_NAV_COOKIE)?.value === "compacto"}
        tema={tema}
      >
        {children}
      </AdminFrame>
    </div>
  );
}
