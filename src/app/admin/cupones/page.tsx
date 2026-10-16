import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AdminCouponManager } from "@/components/admin-coupon-manager";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { listAdminCoupons } from "@/lib/admin-coupons";
import { readAdminSession } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export default async function AdminCouponsPage() {
  const jar = await cookies();
  const session = await readAdminSession(jar.get(ADMIN_COOKIE)?.value);
  if (!session) redirect("/admin/login?next=/admin/cupones");

  const rows = await listAdminCoupons();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[13px] text-adm-muted">Ventas</p>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-adm-fg sm:text-[30px]">Cupones</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Códigos de descuento que el cliente escribe en el carrito o el checkout. Podés ponerles fecha de vencimiento y un tope
          de usos. Un pedido cancelado devuelve su uso.
        </p>
      </div>
      <AdminCouponManager rows={rows} />
    </div>
  );
}
