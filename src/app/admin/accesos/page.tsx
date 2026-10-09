import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AdminAccessManager } from "@/components/admin-access-manager";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { readAdminSession } from "@/lib/admin-session";
import { isOwnerEmail, listAdminAccess } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

export default async function AdminAccessPage() {
  const jar = await cookies();
  const session = await readAdminSession(jar.get(ADMIN_COOKIE)?.value);
  if (!session) redirect("/admin/login?next=/admin/accesos");

  const rows = await listAdminAccess();
  const canManage = !session.email || isOwnerEmail(session.email);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-700">Admin · Control</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-ink-900 sm:text-3xl">Accesos</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Quién puede entrar al panel. Cada uno entra con su cuenta de Google, sin contraseña nuestra. Al quitar a alguien se le
          cierra la sesión en el momento.
        </p>
      </div>
      <AdminAccessManager
        rows={rows.map((r) => ({ ...r, addedAt: r.addedAt.toISOString() }))}
        canManage={canManage}
        me={session.email}
      />
    </div>
  );
}
