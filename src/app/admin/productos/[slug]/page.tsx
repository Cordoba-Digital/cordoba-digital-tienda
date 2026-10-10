import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AdminBackLink } from "@/components/admin-back-link";
import { AdminProductArchiveButton } from "@/components/admin-product-archive-button";
import { AdminProductForm } from "@/components/admin-product-form";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyAdminSessionValue } from "@/lib/admin-session";
import { getAdminProductForEdit, listProductCategories } from "@/lib/admin-products";

export const dynamic = "force-dynamic";

export default async function EditAdminProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const jar = await cookies();
  if (!(await verifyAdminSessionValue(jar.get(ADMIN_COOKIE)?.value))) {
    redirect(`/admin/login?next=${encodeURIComponent(`/admin/productos/${slug}`)}`);
  }

  const [product, categories] = await Promise.all([getAdminProductForEdit(slug), listProductCategories()]);
  if (!product) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <AdminBackLink fallback="/admin/productos" />
          <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-700">Admin · Catálogo</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-ink-900 sm:text-3xl">Editar producto</h1>
          <p className="mt-1 text-sm text-ink-500">
            <Link href={`/producto/${product.slug}`} className="font-semibold text-brand-700 hover:underline" target="_blank">
              Ver en la tienda ↗
            </Link>
            {product.origin === "wp" ? " · Migrado de WordPress: al guardar queda como editado a mano." : null}
          </p>
        </div>
        <AdminProductArchiveButton slug={product.slug} mode="archive" />
      </div>

      <AdminProductForm categories={categories} initial={product} />
    </div>
  );
}
