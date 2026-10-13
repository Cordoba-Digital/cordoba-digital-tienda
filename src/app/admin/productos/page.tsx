import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminProductFilters } from "@/components/admin-product-filters";
import { AdminProductList } from "@/components/admin-product-list";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyAdminSessionValue } from "@/lib/admin-session";
import { listAdminProducts, listProductCategories } from "@/lib/admin-products";

export const dynamic = "force-dynamic";

/** Tanda de productos por carga; las siguientes llegan solas al scrollear. */
const PER_PAGE = 30;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function flag(v: string | string[] | undefined): boolean {
  const first = Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
  return first === "1" || first.toLowerCase() === "true";
}

export default async function AdminProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const jar = await cookies();
  if (!(await verifyAdminSessionValue(jar.get(ADMIN_COOKIE)?.value))) {
    redirect("/admin/login?next=/admin/productos");
  }

  const sp = await searchParams;
  const first = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));
  const q = first(sp.q).trim();
  const category = first(sp.categoria).trim();
  // `?sinStock=1` sigue funcionando (lo usa el Panel) y equivale a `?stock=sin`.
  const stockParam = first(sp.stock);
  const stock: "" | "con" | "sin" = stockParam === "con" || stockParam === "sin" ? stockParam : flag(sp.sinStock) ? "sin" : "";
  const sortParam = first(sp.orden);
  const sort: "" | "stock-desc" | "stock-asc" = sortParam === "stock-desc" || sortParam === "stock-asc" ? sortParam : "";
  const oferta = flag(sp.oferta);
  const destacados = flag(sp.destacados);

  const [{ items, total }, categories] = await Promise.all([
    listAdminProducts({ q, category, sinStock: false, stock, sort, oferta, destacados, page: 1, perPage: PER_PAGE }),
    listProductCategories(),
  ]);
  const base = {
    ...(q ? { q } : {}),
    ...(category ? { categoria: category } : {}),
    ...(stock ? { stock } : {}),
    ...(sort ? { orden: sort } : {}),
    ...(oferta ? { oferta: "1" } : {}),
    ...(destacados ? { destacados: "1" } : {}),
  };
  const query = new URLSearchParams(base).toString();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-700">Admin · Catálogo</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-ink-900 sm:text-3xl">Productos</h1>
          <p className="mt-1 text-sm text-ink-500">
            {total} productos. Cambiá precio y stock desde la lista, o tocá Editar para la ficha completa.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/productos/archivados"
            className="border border-ink-200 px-4 py-2.5 text-sm font-bold text-ink-700 transition-[background-color,color,border-color,box-shadow,opacity] duration-150 hover:border-brand-300"
          >
            Archivados
          </Link>
          <Link
            href="/admin/productos/nuevo"
            className="bg-brand-700 px-4 py-2.5 text-sm font-bold text-white transition-[background-color,color,border-color,box-shadow,opacity] duration-150 hover:bg-brand-800"
          >
            ＋ Nuevo
          </Link>
        </div>
      </div>

      <AdminProductFilters
        q={q}
        category={category}
        categories={categories}
        stock={stock}
        sort={sort}
        oferta={oferta}
        destacados={destacados}
      />

      <AdminProductList key={query} initialItems={items} total={total} perPage={PER_PAGE} query={query} />
    </div>
  );
}
