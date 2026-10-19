import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AdminPaymentMethods, AdminUsdtRate, AdminUsdtWallet } from "@/components/admin-payment-methods";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { isOwnerEmail } from "@/lib/admin-access";
import { readAdminSession } from "@/lib/admin-session";
import { getSavedUsdtRate } from "@/lib/usdt-rate";
import { mailConfigured } from "@/lib/mailer";
import { transferAccount } from "@/lib/transfer-account";
import { getSavedTransferAccount } from "@/lib/transfer-account-server";
import { getSavedUsdtWallet } from "@/lib/usdt-server";

export const dynamic = "force-dynamic";

export default async function AdminPaymentMethodsPage() {
  const jar = await cookies();
  const session = await readAdminSession(jar.get(ADMIN_COOKIE)?.value);
  if (!session) redirect("/admin/login?next=/admin/medios-de-pago");

  const [saved, usdt, usdtRate] = await Promise.all([getSavedTransferAccount(), getSavedUsdtWallet(), getSavedUsdtRate()]);
  const canEdit = !session.email || isOwnerEmail(session.email);
  // Sin nada guardado, el formulario arranca con lo que hoy ve el cliente (las variables de Vercel).
  const fallback = transferAccount();
  const initial = saved ?? (fallback ? { number: fallback.number, alias: fallback.alias, holder: fallback.holder, cuit: fallback.cuit } : null);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[13px] text-adm-muted">Ventas</p>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-adm-fg sm:text-[30px]">Medios de pago</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          A dónde pagan los clientes. Es lo que ven en el checkout y en la página de su pedido, y un cambio vale desde el
          próximo pedido.
        </p>
      </div>
      <AdminPaymentMethods
        initial={initial}
        source={saved ? "panel" : fallback ? "vercel" : "vacio"}
        updatedBy={saved?.updatedBy ?? null}
        updatedAt={saved?.updatedAt.toISOString() ?? null}
        canEdit={canEdit}
        mailReady={mailConfigured()}
      />
      <AdminUsdtWallet
        initial={usdt?.wallet ?? ""}
        updatedBy={usdt?.updatedBy ?? null}
        updatedAt={usdt?.updatedAt.toISOString() ?? null}
        canEdit={canEdit}
      />
      <AdminUsdtRate
        initial={usdtRate?.rate ?? null}
        updatedBy={usdtRate?.updatedBy ?? null}
        updatedAt={usdtRate?.updatedAt ?? null}
        canEdit={canEdit}
      />
    </div>
  );
}
