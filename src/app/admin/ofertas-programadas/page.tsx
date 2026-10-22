import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AdminPriceSchedules, type ScheduleProduct } from "@/components/admin-price-schedules";
import { db } from "@/db";
import { products } from "@/db/schema";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { readAdminSession } from "@/lib/admin-session";
import { listPriceSchedules } from "@/lib/price-schedules";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminPriceSchedulesPage({ searchParams }: { searchParams: SearchParams }) {
  const jar = await cookies();
  const session = await readAdminSession(jar.get(ADMIN_COOKIE)?.value);
  if (!session) redirect("/admin/login?next=/admin/ofertas-programadas");

  // "Programar oferta" desde la ficha del producto llega con el producto elegido.
  const sp = await searchParams;
  const slug = typeof sp.producto === "string" ? sp.producto : "";
  const [rows, [preset]] = await Promise.all([
    listPriceSchedules(),
    slug
      ? db
          .select({ slug: products.slug, name: products.name, price: products.price, compareAtPrice: products.compareAtPrice, stock: products.stock })
          .from(products)
          .where(eq(products.slug, slug))
          .limit(1)
      : Promise.resolve([] as ScheduleProduct[]),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[13px] text-adm-muted">Catálogo</p>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-adm-fg sm:text-[30px]">Ofertas programadas</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Un precio de oferta que empieza y termina a la hora exacta que pongas (hora de Córdoba), por ejemplo para el
          CyberMonday. Nunca empieza antes. Al empezar, el precio que tenía el producto queda tachado como precio anterior;
          al terminar, vuelve solo. Si durante la oferta cambiás el precio a mano, al terminar se respeta el tuyo.
        </p>
      </div>
      <AdminPriceSchedules rows={rows} preset={preset ?? null} />
    </div>
  );
}
