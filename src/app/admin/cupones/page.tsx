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
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-700">Admin · Ventas</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-ink-900 sm:text-3xl">Cupones</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Códigos de descuento que el cliente escribe en el carrito o el checkout. Podés ponerles fecha de vencimiento y un tope
          de usos. Un pedido cancelado devuelve su uso.
        </p>
      </div>
      <AdminCouponManager rows={rows} />
    </div>
  );
}
