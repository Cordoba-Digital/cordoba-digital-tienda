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
        <p className="mt-2 text-[13px] text-adm-muted">Catálogo</p>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-adm-fg sm:text-[30px]">Nuevo producto</h1>
        <p className="mt-1 text-sm text-ink-500">
          Alta manual: el producto queda con origen manual y no lo pisa la migración.
        </p>
      </div>

      <AdminProductGuide />

      <AdminProductForm categories={categories} knownBrands={knownBrands} />
    </div>
  );
}
