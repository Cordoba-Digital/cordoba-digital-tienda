import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AdminLoginForm } from "@/components/admin-login-form";
import { ADMIN_COOKIE, adminGoogleConfigured, adminPasswordConfigured } from "@/lib/admin-auth";
import { verifyAdminSessionValue } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

/** Solo páginas del panel (nunca otro sitio ni de vuelta al login). */
function adminNext(raw: string | string[] | undefined): string {
  const next = Array.isArray(raw) ? raw[0] : raw;
  if (!next || !/^\/admin(?:[/?][^\\\s]*)?$/.test(next) || next.startsWith("/admin/login")) return "/admin";
  return next;
}

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Con la sesión ya abierta no tiene sentido pedir la contraseña otra vez
  // (antes se veía el menú del panel al lado del formulario de ingreso).
  const jar = await cookies();
  if (await verifyAdminSessionValue(jar.get(ADMIN_COOKIE)?.value)) {
    redirect(adminNext((await searchParams).next));
  }
  return (
    <Suspense>
      <AdminLoginForm google={adminGoogleConfigured()} password={adminPasswordConfigured()} />
    </Suspense>
  );
}
