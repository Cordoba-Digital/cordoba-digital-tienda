import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AdminAutomations, type AutomationView } from "@/components/admin-automations";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { readAdminSession } from "@/lib/admin-session";
import { AUTOMATION_IDS, AUTOMATIONS, getAutomations } from "@/lib/automations";
import { mailConfigured } from "@/lib/mailer";

export const dynamic = "force-dynamic";

export default async function AdminAutomationsPage() {
  const jar = await cookies();
  const session = await readAdminSession(jar.get(ADMIN_COOKIE)?.value);
  if (!session) redirect("/admin/login?next=/admin/automatizaciones");

  const state = await getAutomations();
  // Avisos para quien configura Vercel: el interruptor se puede prender igual y vale en cuanto esté la variable.
  const warnings: Partial<Record<keyof typeof AUTOMATIONS, string>> = {
    vencerPedidos: process.env.CRON_SECRET?.trim()
      ? undefined
      : "Corre cada vez que se abre el panel. Para que corra también solo todos los días, falta CRON_SECRET en Vercel.",
    avisarCliente: mailConfigured()
      ? undefined
      : "Todavía no hay correo de salida configurado (SMTP en Vercel). Hasta entonces no se manda ningún email.",
  };
  const rows: AutomationView[] = AUTOMATION_IDS.map((id) => ({
    id,
    label: AUTOMATIONS[id].label,
    description: AUTOMATIONS[id].description,
    enabled: state[id],
    warning: warnings[id] ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-700">Admin · Control</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-ink-900 sm:text-3xl">Automatizaciones</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Pasos que la tienda puede hacer sola. Cada cambio vale enseguida y queda registrado en Actividad.
        </p>
      </div>
      <AdminAutomations rows={rows} />
    </div>
  );
}
