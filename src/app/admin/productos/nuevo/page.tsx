import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminProductForm } from "@/components/admin-product-form";
import { ADMIN_COOKIE, verifyAdminSessionValue } from "@/lib/admin-auth";
import { listProductCategories } from "@/lib/admin-products";

export const dynamic = "force-dynamic";

export default async function NewAdminProductPage() {
  const jar = await cookies();
  if (!(await verifyAdminSessionValue(jar.get(ADMIN_COOKIE)?.value))) {
    redirect("/admin/login?next=/admin/productos/nuevo");
  }

  const categories = await listProductCategories();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/productos" className="text-xs font-bold text-brand-700 hover:underline">
          ← Volver a productos
        </Link>
        <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-700">Admin · Catálogo</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-ink-900 sm:text-3xl">Nuevo producto</h1>
        <p className="mt-1 text-sm text-ink-500">
          Alta manual: el producto queda con origen manual y no lo pisa la migración.
        </p>
      </div>

      <AdminProductForm categories={categories} />
    </div>
  );
}
