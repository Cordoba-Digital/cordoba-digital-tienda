import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminBackLink } from "@/components/admin-back-link";
import { AdminProductForm } from "@/components/admin-product-form";
import { AdminProductGuide } from "@/components/admin-product-guide";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyAdminSessionValue } from "@/lib/admin-session";
import { listKnownBrands, listProductCategories } from "@/lib/admin-products";

export const dynamic = "force-dynamic";

export default async function NewAdminProductPage() {
  const jar = await cookies();
  if (!(await verifyAdminSessionValue(jar.get(ADMIN_COOKIE)?.value))) {
    redirect("/admin/login?next=/admin/productos/nuevo");
  }

  const [categories, knownBrands] = await Promise.all([listProductCategories(), listKnownBrands()]);

  return (
    <div className="space-y-6">
      <div>
        <AdminBackLink fallback="/admin/productos" />
        <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-700">Admin · Catálogo</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-ink-900 sm:text-3xl">Nuevo producto</h1>
        <p className="mt-1 text-sm text-ink-500">
          Alta manual: el producto queda con origen manual y no lo pisa la migración.
        </p>
      </div>

      <AdminProductGuide />

      <AdminProductForm categories={categories} knownBrands={knownBrands} />
    </div>
  );
}
