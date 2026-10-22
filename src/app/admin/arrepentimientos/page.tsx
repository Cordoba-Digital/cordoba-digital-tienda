import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminCopyButton } from "@/components/admin-copy-button";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { ARREPENTIMIENTO_DIAS, listArrepentimientos } from "@/lib/admin-arrepentimientos";
import { customerMail, tramiteCode } from "@/lib/arrepentimiento";
import { whatsappHref } from "@/lib/admin-order-helpers";
import { verifyAdminSessionValue } from "@/lib/admin-session";
import { formatAgo, formatDateTime } from "@/lib/format";
import { statusLabel } from "@/lib/pricing";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const DAY = 24 * 60 * 60 * 1000;

/** El formulario manda la fecha como "2026-10-08"; acá se lee "08/10/2026". */
function fechaAR(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
}

function mailtoHref(r: Parameters<typeof customerMail>[0]): string {
  const mail = customerMail(r);
  return `mailto:${encodeURIComponent(mail.to)}?subject=${encodeURIComponent(mail.subject)}&body=${encodeURIComponent(mail.text)}`;
}

export default async function AdminArrepentimientosPage({ searchParams }: { searchParams: SearchParams }) {
  const jar = await cookies();
  if (!(await verifyAdminSessionValue(jar.get(ADMIN_COOKIE)?.value))) {
    redirect("/admin/login?next=/admin/arrepentimientos");
  }
  const sp = await searchParams;
  const rawPage = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const page = Math.max(1, Number(rawPage) || 1);
  const { items, total, pages } = await listArrepentimientos({ page, perPage: 20 });
  const now = new Date();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[13px] text-adm-muted">Ventas</p>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-adm-fg sm:text-[30px]">Arrepentimientos</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Lo que llega desde el botón de arrepentimiento de la tienda. Por ley el cliente puede devolver la compra dentro
          de los {ARREPENTIMIENTO_DIAS} días de recibida, así que conviene contactarlo el mismo día.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="admin-card p-8 text-center">
          <p className="font-bold text-ink-900">No hay solicitudes.</p>
          <p className="mt-1 text-sm text-ink-500">Cuando un cliente use el botón de arrepentimiento, aparece acá.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((r) => {
            const fresh = now.getTime() - r.createdAt.getTime() < ARREPENTIMIENTO_DIAS * DAY;
            const wa = whatsappHref(
              r.telefono,
              `Hola ${r.nombre.split(" ")[0]}, te escribimos de Córdoba Digital por tu solicitud de arrepentimiento${
                r.numeroPedido ? ` del pedido ${r.numeroPedido}` : ""
              }.`,
            );
            return (
              <li key={r.id} className="admin-card p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-base font-black text-ink-900">
                      {r.nombre}
                      <span className="font-mono text-xs font-bold text-ink-500">{tramiteCode(r.id)}</span>
                    </p>
                    <p className="mt-0.5 text-sm text-ink-700">{r.producto}</p>
                  </div>
                  <div className="text-right text-xs text-ink-500">
                    <p className={fresh ? "font-bold text-brand-700" : ""} title={formatDateTime(r.createdAt)}>
                      {formatAgo(r.createdAt, now)}
                    </p>
                    <p>Compró: {r.fechaCompra ? fechaAR(r.fechaCompra) : "sin dato"}</p>
                  </div>
                </div>

                <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <dt className="text-ink-500">Pedido:</dt>
                    <dd className="font-semibold text-ink-900">
                      {r.orderCode ? (
                        <Link href={`/admin/pedidos/${encodeURIComponent(r.orderCode)}`} className="text-brand-700 hover:underline">
                          {r.orderCode}
                        </Link>
                      ) : (
                        r.numeroPedido || "no lo indicó"
                      )}
                      {r.orderStatus ? <span className="ml-2 text-xs font-normal text-ink-500">({statusLabel(r.orderStatus)})</span> : null}
                      {r.numeroPedido && !r.orderCode ? (
                        <span className="ml-2 text-xs font-normal text-ink-500">(no coincide con ningún pedido)</span>
                      ) : null}
                    </dd>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <dt className="text-ink-500">Email:</dt>
                    <dd className="flex items-center gap-2 font-semibold text-ink-900">
                      <a href={`mailto:${r.email}`} className="break-all hover:underline">{r.email}</a>
                      <AdminCopyButton value={r.email} />
                    </dd>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <dt className="text-ink-500">Teléfono:</dt>
                    <dd className="flex items-center gap-2 font-semibold text-ink-900">
                      {r.telefono}
                      <AdminCopyButton value={r.telefono} />
                    </dd>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <dt className="text-ink-500">Otros pedidos:</dt>
                    <dd>
                      <Link href={`/admin/pedidos?q=${encodeURIComponent(r.email)}`} className="font-semibold text-brand-700 hover:underline">
                        Buscar por su email
                      </Link>
                    </dd>
                  </div>
                </dl>

                {r.comentarios ? (
                  <p className="mt-3 whitespace-pre-line border-l-2 border-ink-200 pl-3 text-sm text-ink-700">{r.comentarios}</p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                {wa ? (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-brand-700 px-4 py-2 text-sm font-bold text-white hover:bg-brand-800"
                  >
                    Escribirle por WhatsApp
                  </a>
                ) : null}
                {/* El código se le manda solo al enviar el formulario. Si el email no
                    salió (falla del correo), esto lo deja listo para mandarlo a mano. */}
                <a href={mailtoHref(r)} className="inline-block border border-ink-200 px-4 py-2 text-sm font-bold text-ink-700 hover:bg-ink-50">
                  Reenviar el código por email
                </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-ink-500">
            {total} solicitudes · página {page} de {pages}
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link href={`/admin/arrepentimientos?page=${page - 1}`} className="border border-ink-200 px-4 py-2 text-xs font-bold text-ink-700">
                ← Más nuevas
              </Link>
            ) : null}
            {page < pages ? (
              <Link href={`/admin/arrepentimientos?page=${page + 1}`} className="border border-ink-200 px-4 py-2 text-xs font-bold text-ink-700">
                Más viejas →
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
