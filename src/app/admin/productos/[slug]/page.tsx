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

export default async function EditAdminProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const justCreated = (await searchParams).creado === "1";
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
          <p className="mt-2 text-[13px] text-adm-muted">Catálogo</p>
          <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-adm-fg sm:text-[30px]">Editar producto</h1>
          <p className="mt-1 text-sm text-ink-500">
            <Link href={`/producto/${product.slug}`} className="font-semibold text-brand-700 hover:underline" target="_blank">
              Ver en la tienda ↗
            </Link>
            {product.origin === "wp" ? " · Migrado de WordPress: al guardar queda como editado a mano." : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/ofertas-programadas?producto=${encodeURIComponent(product.slug)}`}
            className="border border-ink-300 px-3 py-2 text-xs font-bold text-ink-700 hover:border-ink-500"
          >
            Programar oferta
          </Link>
          <AdminProductArchiveButton slug={product.slug} mode="archive" />
        </div>
      </div>

      {justCreated ? (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
          <p className="font-semibold text-emerald-800">Producto creado y publicado en la tienda.</p>
          <div className="flex flex-wrap gap-3 font-bold">
            <Link href={`/producto/${product.slug}`} target="_blank" className="text-emerald-800 hover:underline">Verlo en la tienda ↗</Link>
            <Link href="/admin/productos/nuevo" className="text-emerald-800 hover:underline">Cargar otro</Link>
          </div>
        </div>
      ) : null}

      <AdminProductForm categories={categories} initial={product} />
    </div>
  );
}
