import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AdminPaymentMethods } from "@/components/admin-payment-methods";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { isOwnerEmail } from "@/lib/admin-access";
import { readAdminSession } from "@/lib/admin-session";
import { mailConfigured } from "@/lib/mailer";
import { transferAccount } from "@/lib/transfer-account";
import { getSavedTransferAccount } from "@/lib/transfer-account-server";

export const dynamic = "force-dynamic";

export default async function AdminPaymentMethodsPage() {
  const jar = await cookies();
  const session = await readAdminSession(jar.get(ADMIN_COOKIE)?.value);
  if (!session) redirect("/admin/login?next=/admin/medios-de-pago");

  const saved = await getSavedTransferAccount();
  // Sin nada guardado, el formulario arranca con lo que hoy ve el cliente (las variables de Vercel).
  const fallback = transferAccount();
  const initial = saved ?? (fallback ? { number: fallback.number, alias: fallback.alias, holder: fallback.holder, cuit: fallback.cuit } : null);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[13px] text-adm-muted">Ventas</p>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-adm-fg sm:text-[30px]">Medios de pago</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          La cuenta a la que transfieren los clientes. Es lo que ven en el checkout y en la página de su pedido, y el cambio vale
          desde el próximo pedido.
        </p>
      </div>
      <AdminPaymentMethods
        initial={initial}
        source={saved ? "panel" : fallback ? "vercel" : "vacio"}
        updatedBy={saved?.updatedBy ?? null}
        updatedAt={saved?.updatedAt.toISOString() ?? null}
        canEdit={!session.email || isOwnerEmail(session.email)}
        mailReady={mailConfigured()}
      />
    </div>
  );
}
