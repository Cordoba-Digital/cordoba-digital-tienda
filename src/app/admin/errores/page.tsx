import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AdminErrorList, type ErrorView } from "@/components/admin-error-list";
import { ADMIN_COOKIE, adminEmails } from "@/lib/admin-auth";
import { readAdminSession } from "@/lib/admin-session";
import { listErrors } from "@/lib/error-log";
import { formatDateTime } from "@/lib/format";
import { mailConfigured } from "@/lib/mailer";

export const dynamic = "force-dynamic";

export default async function AdminErrorsPage() {
  const jar = await cookies();
  const session = await readAdminSession(jar.get(ADMIN_COOKIE)?.value);
  if (!session) redirect("/admin/login?next=/admin/errores");

  const rows: ErrorView[] = (await listErrors()).map((e) => ({
    fingerprint: e.fingerprint,
    message: e.message,
    stack: e.stack,
    where: `${e.method} ${e.path || e.route}`.trim(),
    route: e.route,
    count: e.count,
    firstSeen: formatDateTime(e.firstSeen),
    lastSeen: formatDateTime(e.lastSeen),
    resolved: e.resolvedAt !== null,
  }));
  const alerts = mailConfigured() && adminEmails().length > 0;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-700">Admin · Control</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-ink-900 sm:text-3xl">Errores</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Fallas del servidor que la tienda no pudo manejar, agrupadas por tipo. Marcalas resueltas cuando estén arregladas: si
          vuelven a pasar, aparecen de nuevo arriba.
        </p>
        {alerts ? null : (
          <p className="mt-2 text-xs font-semibold text-amber-700">
            Los avisos por email están apagados hasta que haya correo de salida (SMTP) en Vercel. Mientras tanto, los errores
            quedan solo acá.
          </p>
        )}
      </div>
      <AdminErrorList rows={rows} />
    </div>
  );
}
