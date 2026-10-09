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
  // `?sinStock=1` sigue funcionando (lo usa el Panel) y equivale a `?stock=sin`.
  const stockParam = first(sp.stock);
  const stock: "" | "con" | "sin" = stockParam === "con" || stockParam === "sin" ? stockParam : flag(sp.sinStock) ? "sin" : "";
  const sortParam = first(sp.orden);
  const sort: "" | "stock-desc" | "stock-asc" = sortParam === "stock-desc" || sortParam === "stock-asc" ? sortParam : "";
  const oferta = flag(sp.oferta);
  const destacados = flag(sp.destacados);
  const page = Math.max(1, Number(first(sp.page)) || 1);

  const [{ items, total, pages }, categories] = await Promise.all([
    listAdminProducts({ q, category, sinStock: false, stock, sort, oferta, destacados, page, perPage: 20 }),
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

  const stockOptions = [
    { id: "", label: "Todos" },
    { id: "con", label: "Con stock" },
    { id: "sin", label: "Sin stock" },
  ] as const;
  // Encabezado Stock: sin orden → mayor a menor → menor a mayor → sin orden.
  const nextSort = sort === "" ? "stock-desc" : sort === "stock-desc" ? "stock-asc" : null;
  const sortHint = sort === "stock-desc" ? "mayor a menor" : sort === "stock-asc" ? "menor a mayor" : "";

  const toggles = [
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
            className="border border-ink-200 px-4 py-2.5 text-sm font-bold text-ink-700 transition hover:border-brand-300"
          >
            Archivados
          </Link>
          <Link
            href="/admin/productos/nuevo"
            className="bg-brand-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-800"
          >
            ＋ Nuevo
          </Link>
        </div>
      </div>

      <form action="/admin/productos" method="get" className="flex flex-wrap gap-2">
        {stock ? <input type="hidden" name="stock" value={stock} /> : null}
        {sort ? <input type="hidden" name="orden" value={sort} /> : null}
        {oferta ? <input type="hidden" name="oferta" value="1" /> : null}
        {destacados ? <input type="hidden" name="destacados" value="1" /> : null}
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre, SKU o marca…"
          className="min-w-0 basis-full border sm:basis-auto sm:flex-1 border-ink-200 bg-surface px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-400"
        />
        <select
          name="categoria"
          defaultValue={category}
          className="border border-ink-200 bg-surface px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-400"
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="submit" className="bg-ink-900 px-4 py-2.5 text-sm font-bold text-white">
          Buscar
        </button>
        {q || category || stock || sort || oferta || destacados ? (
          <Link href="/admin/productos" className="border border-ink-200 px-4 py-2.5 text-sm font-bold text-ink-600">
            Limpiar
          </Link>
        ) : null}
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex border border-ink-200 bg-surface" role="group" aria-label="Filtrar por stock">
          <span className="border-r border-ink-200 px-3 py-1.5 text-xs font-bold text-ink-500">Stock</span>
          {stockOptions.map((o) => (
            <Link
              key={o.id || "todos"}
              href={withParams(base, { stock: o.id || null, page: null })}
              aria-current={stock === o.id ? "true" : undefined}
              className={`px-3 py-1.5 text-xs font-bold transition ${
                stock === o.id ? "bg-brand-700 text-white" : "text-ink-600 hover:bg-ink-50"
              }`}
            >
              {o.label}
            </Link>
          ))}
        </div>
        {toggles.map((t) => (
          <Link
            key={t.id}
            href={withParams(base, { [t.id]: t.active ? null : "1", page: null })}
            className={`border px-4 py-1.5 text-xs font-bold transition ${
              t.active
                ? "border-brand-700 bg-brand-700 text-white"
                : "border-ink-200 bg-surface text-ink-600 hover:border-brand-300"
            }`}
          >
            {t.label}
          </Link>
        ))}
        <div className="flex border border-ink-200 bg-surface lg:hidden" role="group" aria-label="Ordenar">
          {([
            { id: "", label: "Recientes" },
            { id: "stock-desc", label: "Más stock" },
            { id: "stock-asc", label: "Menos stock" },
          ] as const).map((o) => (
            <Link
              key={o.id || "recientes"}
              href={withParams(base, { orden: o.id || null, page: null })}
              className={`px-3 py-1.5 text-xs font-bold ${sort === o.id ? "bg-ink-900 text-white" : "text-ink-600"}`}
            >
              {o.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="admin-table" role="table" aria-label="Productos">
        <div
          role="row"
          className="hidden border-b border-ink-100 px-4 py-3 text-xs font-bold uppercase tracking-wide text-ink-500 lg:grid lg:grid-cols-[minmax(0,1fr)_8.5rem_5rem_8.5rem_6rem] lg:gap-4"
        >
          <span role="columnheader">Producto</span>
          <span role="columnheader">Precio</span>
          <span role="columnheader" aria-sort={sort === "stock-desc" ? "descending" : sort === "stock-asc" ? "ascending" : "none"}>
            <Link
              href={withParams(base, { orden: nextSort, page: null })}
              title="Ordenar por stock"
              className={`inline-flex items-center gap-1 hover:text-ink-900 ${sort ? "text-ink-900" : ""}`}
            >
              Stock
              <span aria-hidden>{sort === "stock-desc" ? "↓" : sort === "stock-asc" ? "↑" : "↕"}</span>
              <span className="sr-only">{sortHint ? `ordenado de ${sortHint}` : "sin ordenar"}</span>
            </Link>
          </span>
          <span role="columnheader">Etiqueta</span>
          <span role="columnheader" className="text-right">Acción</span>
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-500">Sin productos para este filtro.</p>
        ) : (
          items.map((p) => <AdminProductRow key={p.slug} product={p} />)
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-ink-500">Página {page} de {pages}</p>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link
              href={withParams({ ...base, page: String(page - 1) }, {})}
              className="border border-ink-200 px-4 py-2 text-xs font-bold text-ink-700"
            >
              ← Anterior
            </Link>
          ) : null}
          {page < pages ? (
            <Link
              href={withParams({ ...base, page: String(page + 1) }, {})}
              className="border border-ink-200 px-4 py-2 text-xs font-bold text-ink-700"
            >
              Siguiente →
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
