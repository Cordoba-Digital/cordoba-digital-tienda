import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminProductRow } from "@/components/admin-product-row";
import { ADMIN_COOKIE, verifyAdminSessionValue } from "@/lib/admin-auth";
import { listAdminProducts, listProductCategories } from "@/lib/admin-products";

export const dynamic = "force-dynamic";

function withParams(base: Record<string, string>, overrides: Record<string, string | null>): string {
  const params = new URLSearchParams(base);
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null || value === "") params.delete(key);
    else params.set(key, value);
  }
  const query = params.toString();
  return query ? `/admin/productos?${query}` : "/admin/productos";
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
  const sinStock = flag(sp.sinStock);
  const oferta = flag(sp.oferta);
  const destacados = flag(sp.destacados);
  const page = Math.max(1, Number(first(sp.page)) || 1);

  const [{ items, total, pages }, categories] = await Promise.all([
    listAdminProducts({ q, category, sinStock, oferta, destacados, page, perPage: 20 }),
    listProductCategories(),
  ]);
  const base = {
    ...(q ? { q } : {}),
    ...(category ? { categoria: category } : {}),
    ...(sinStock ? { sinStock: "1" } : {}),
    ...(oferta ? { oferta: "1" } : {}),
    ...(destacados ? { destacados: "1" } : {}),
  };

  const toggles = [
    { id: "sinStock", label: "Sin stock", active: sinStock },
    { id: "oferta", label: "En oferta", active: oferta },
    { id: "destacados", label: "Destacados", active: destacados },
  ];

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
            className="rounded-xl border border-ink-200 px-4 py-2.5 text-sm font-bold text-ink-700 transition hover:border-brand-300"
          >
            Archivados
          </Link>
          <Link
            href="/admin/productos/nuevo"
            className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-800"
          >
            ＋ Nuevo
          </Link>
        </div>
      </div>

      <form action="/admin/productos" method="get" className="flex flex-wrap gap-2">
        {category ? <input type="hidden" name="categoria" value={category} /> : null}
        {sinStock ? <input type="hidden" name="sinStock" value="1" /> : null}
        {oferta ? <input type="hidden" name="oferta" value="1" /> : null}
        {destacados ? <input type="hidden" name="destacados" value="1" /> : null}
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre, SKU o marca…"
          className="min-w-0 flex-1 rounded-xl border border-ink-200 bg-surface px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-400"
        />
        <select
          name="categoria"
          defaultValue={category}
          className="rounded-xl border border-ink-200 bg-surface px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-400"
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-xl bg-ink-900 px-4 py-2.5 text-sm font-bold text-white">
          Buscar
        </button>
        {q || category || sinStock || oferta || destacados ? (
          <Link href="/admin/productos" className="rounded-xl border border-ink-200 px-4 py-2.5 text-sm font-bold text-ink-600">
            Limpiar
          </Link>
        ) : null}
      </form>

      <div className="flex flex-wrap gap-2">
        {toggles.map((t) => (
          <Link
            key={t.id}
            href={withParams(base, { [t.id]: t.active ? null : "1", page: null })}
            className={`rounded-full border px-4 py-1.5 text-xs font-bold transition ${
              t.active
                ? "border-brand-700 bg-brand-700 text-white"
                : "border-ink-200 bg-surface text-ink-600 hover:border-brand-300"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="card-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3">Precio</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Etiqueta</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-500">Sin productos para este filtro.</td></tr>
              ) : (
                items.map((p) => <AdminProductRow key={p.slug} product={p} />)
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-ink-500">Página {page} de {pages}</p>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link
              href={withParams({ ...base, page: String(page - 1) }, {})}
              className="rounded-xl border border-ink-200 px-4 py-2 text-xs font-bold text-ink-700"
            >
              ← Anterior
            </Link>
          ) : null}
          {page < pages ? (
            <Link
              href={withParams({ ...base, page: String(page + 1) }, {})}
              className="rounded-xl border border-ink-200 px-4 py-2 text-xs font-bold text-ink-700"
            >
              Siguiente →
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
