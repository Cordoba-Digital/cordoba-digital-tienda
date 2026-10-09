import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminProductArchiveButton } from "@/components/admin-product-archive-button";
import { ADMIN_COOKIE, verifyAdminSessionValue } from "@/lib/admin-auth";
import { listArchivedProducts } from "@/lib/admin-products";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ArchivedProductsPage() {
  const jar = await cookies();
  if (!(await verifyAdminSessionValue(jar.get(ADMIN_COOKIE)?.value))) {
    redirect("/admin/login?next=/admin/productos/archivados");
  }
  const items = await listArchivedProducts();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/productos" className="text-xs font-bold text-brand-700 hover:underline">
          ← Volver a productos
        </Link>
        <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-700">Admin · Catálogo</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-ink-900 sm:text-3xl">Archivados</h1>
        <p className="mt-1 text-sm text-ink-500">
          No se ven en la tienda, el buscador ni Google Shopping. Restaurar los vuelve a publicar con todos sus datos.
        </p>
      </div>

      <div className="card-surface overflow-hidden">
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-500">No hay productos archivados.</p>
        ) : (
          <ul>
            {items.map((p) => (
              <li key={p.slug} className="flex items-center gap-3 border-b border-ink-50 px-4 py-3 last:border-0">
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image} alt="" referrerPolicy="no-referrer" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="h-12 w-12 shrink-0 rounded-lg bg-ink-50" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-900" title={p.name}>{p.name}</p>
                  <p className="text-xs text-ink-500">
                    {money(p.price)} · archivado el {p.archivedAt.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Cordoba" })}
                  </p>
                </div>
                <AdminProductArchiveButton slug={p.slug} mode="restore" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
