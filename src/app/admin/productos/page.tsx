import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminIcon } from "@/components/admin-icon";
import type { AdminIconName } from "@/components/admin-nav-items";
import { AdminProductFilters } from "@/components/admin-product-filters";
import { AdminProductList } from "@/components/admin-product-list";
import { AdminPageHeader, adminBtn, adminChip } from "@/components/admin-ui";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyAdminSessionValue } from "@/lib/admin-session";
import { listAdminProducts, listArchivedProducts, listProductCategories } from "@/lib/admin-products";

export const dynamic = "force-dynamic";

/** Tanda de productos por carga; las siguientes llegan solas al scrollear. */
const PER_PAGE = 30;

/** Tarjeta de número del catálogo; lleva a la lista ya filtrada. */
function Stat({ href, icon, color, label, value }: { href: string; icon: AdminIconName; color: string; label: string; value: string }) {
  return (
    <Link href={href} className="admin-card flex items-center gap-3.5 px-[18px] py-4 transition-[background-color] duration-150 hover:bg-white/[0.06]">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: `${color}26`, color }}>
        <AdminIcon name={icon} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[13px] text-[#8b8f98]">{label}</span>
        <span className="admin-mono text-[22px] leading-tight text-white">{value}</span>
      </span>
    </Link>
  );
}

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

  const all = { q: "", category: "", sinStock: false, stock: "" as const, sort: "" as const, oferta: false, destacados: false, page: 1, perPage: 1 };
  const [{ items, total }, categories, published, outOfStock, archived] = await Promise.all([
    listAdminProducts({ q, category, sinStock: false, stock, sort, oferta, destacados, page: 1, perPage: PER_PAGE }),
    listProductCategories(),
    listAdminProducts(all),
    listAdminProducts({ ...all, stock: "sin" }),
    listArchivedProducts(),
  ]);
  // El nombre corto de cada categoría (la última parte de la ruta) para mostrar en la lista.
  const categoryNames = Object.fromEntries(categories.map((c) => [c.slug, c.name.split(" › ").pop() ?? c.name]));
  const n = (value: number) => value.toLocaleString("es-AR");
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
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        eyebrow="Catálogo"
        title="Productos"
        description={`${n(total)} ${total === 1 ? "producto" : "productos"}${query ? " con estos filtros" : ""}. Cambiá precio y stock desde la lista, o tocá Editar para la ficha completa.`}
        actions={
          <>
            <Link href="/admin/productos/archivados" className={adminChip}>
              <AdminIcon name="archivo" className="h-4 w-4" />
              Archivados
            </Link>
            <Link href="/admin/productos/nuevo" className={adminBtn}>
              <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Nuevo producto
            </Link>
          </>
        }
      />

      <section aria-label="Resumen del catálogo" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat href="/admin/productos" icon="productos" color="#ff7440" label="Publicados" value={n(published.total)} />
        <Stat href="/admin/productos" icon="panel" color="#7fb0ff" label="Categorías" value={n(categories.length)} />
        <Stat href="/admin/productos?stock=sin" icon="errores" color="#ff8a8a" label="Sin stock" value={n(outOfStock.total)} />
        <Stat href="/admin/productos/archivados" icon="archivo" color="#b79cff" label="Archivados" value={archived.length >= 200 ? "200+" : n(archived.length)} />
      </section>

      <AdminProductFilters
        q={q}
        category={category}
        categories={categories}
        stock={stock}
        sort={sort}
        oferta={oferta}
        destacados={destacados}
      />

      <AdminProductList key={query} initialItems={items} total={total} perPage={PER_PAGE} query={query} categoryNames={categoryNames} />
    </div>
  );
}
