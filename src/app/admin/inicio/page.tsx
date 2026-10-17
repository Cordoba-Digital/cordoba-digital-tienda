import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AdminHomeLayout } from "@/components/admin-home-layout";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { readAdminSession } from "@/lib/admin-session";
import { getHomeLayoutRecord } from "@/lib/home-layout-server";

export const dynamic = "force-dynamic";

const when = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Cordoba",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function AdminHomePage() {
  const jar = await cookies();
  const session = await readAdminSession(jar.get(ADMIN_COOKIE)?.value);
  if (!session) redirect("/admin/login?next=/admin/inicio");

  const record = await getHomeLayoutRecord();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[13px] text-adm-muted">Tienda</p>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-adm-fg sm:text-[30px]">Inicio de la tienda</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Qué bloques muestra la página principal y en qué orden. Los cambios se ven en la tienda apenas guardás.
        </p>
        <p className="mt-1 text-xs text-ink-400">
          {record.updatedAt
            ? `Último cambio: ${record.updatedBy} el ${when.format(record.updatedAt)}.`
            : "Todavía no se cambió: la home usa el orden de siempre."}
        </p>
      </div>
      <AdminHomeLayout initial={record.layout} />
    </div>
  );
}
