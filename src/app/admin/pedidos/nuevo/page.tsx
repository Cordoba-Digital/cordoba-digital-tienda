import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminManualOrderForm } from "@/components/admin-manual-order-form";
import { AdminPageHeader, adminChip } from "@/components/admin-ui";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyAdminSessionValue } from "@/lib/admin-session";
import { mercadoPagoReady } from "@/lib/mercadopago";
import { PENDING_EXPIRY_HOURS, SENA_EXPIRY_HOURS, STOCK_HOLD_HOURS } from "@/lib/payment-rules";

export const dynamic = "force-dynamic";

export default async function AdminNewOrderPage() {
  const jar = await cookies();
  if (!(await verifyAdminSessionValue(jar.get(ADMIN_COOKIE)?.value))) {
    redirect("/admin/login?next=/admin/pedidos/nuevo");
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        eyebrow={
          <Link href="/admin/pedidos" className="hover:text-adm-fg">
            Pedidos
          </Link>
        }
        title="Pedido manual"
        description={`Para ventas por WhatsApp, teléfono o en el local. El pedido queda pendiente de pago y le mandás el link al cliente: el stock se le guarda ${STOCK_HOLD_HOURS} horas y, si no paga en ${PENDING_EXPIRY_HOURS} (${SENA_EXPIRY_HOURS} con seña), se cancela solo. Si ya cobraste en el local, marcá «Ya lo cobré y se lo llevó» y queda como venta terminada.`}
        actions={
          <Link href="/admin/pedidos" className={adminChip}>
            Volver a pedidos
          </Link>
        }
      />
      <AdminManualOrderForm mercadoPago={mercadoPagoReady()} />
    </div>
  );
}
