import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AdminOrderManageForm } from "@/components/admin-order-manage-form";
import { OrderConfirmation, type OrderSummary } from "@/components/order-confirmation";
import { Pill } from "@/components/ui";
import { ADMIN_COOKIE, verifyAdminSessionValue } from "@/lib/admin-auth";
import { getAdminOrderDetail } from "@/lib/admin-orders";
import { formatDateTime } from "@/lib/format";
import { statusLabel } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const jar = await cookies();
  const { code } = await params;
  if (!(await verifyAdminSessionValue(jar.get(ADMIN_COOKIE)?.value))) {
    redirect(`/admin/login?next=/admin/pedidos/${encodeURIComponent(code)}`);
  }

  const result = await getAdminOrderDetail(decodeURIComponent(code));
  if (!result) notFound();
  const { order, items, events } = result;

  const summary: OrderSummary = {
    code: order.code,
    status: order.status,
    customerName: order.customerName,
    email: order.email,
    phone: order.phone,
    deliveryMethod: order.deliveryMethod,
    deliveryLabel: order.deliveryLabel,
    deliveryEta: order.deliveryEta,
    address: order.address,
    paymentMethod: order.paymentMethod,
    paymentLabel: order.paymentLabel,
    installments: order.installments,
    subtotal: order.subtotal,
    discount: order.discount,
    paymentAdjustment: order.paymentAdjustment,
    shippingCost: order.shippingCost,
    total: order.total,
    couponCode: order.couponCode,
    notes: order.notes,
    createdAt: formatDateTime(order.createdAt),
    items: items.map((item) => ({
      name: item.name,
      image: item.image,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      productSlug: item.productSlug,
    })),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/pedidos" className="text-sm font-bold text-brand-700 hover:underline">← Volver a pedidos</Link>
        <Pill tone="neutral">{statusLabel(order.status)}</Pill>
      </div>

      <div className="admin-card space-y-4 p-5">
        <h2 className="text-lg font-extrabold text-ink-900">Gestión interna</h2>
        <AdminOrderManageForm code={order.code} currentStatus={order.status} trackingCode={order.trackingCode ?? ""} />
        <dl className="grid gap-2 text-xs text-ink-500 md:grid-cols-2">
          <div className="flex justify-between gap-2"><dt>Preferencia MP</dt><dd className="font-mono">{order.mercadopagoPreferenceId ?? "—"}</dd></div>
          <div className="flex justify-between gap-2"><dt>Pago MP</dt><dd className="font-mono">{order.mercadopagoPaymentId ?? "—"}</dd></div>
          <div className="flex justify-between gap-2"><dt>Teléfono</dt><dd>{order.phone}</dd></div>
          <div className="flex justify-between gap-2"><dt>Creado</dt><dd>{formatDateTime(order.createdAt)}</dd></div>
        </dl>
        {events.length ? (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-ink-400">Historial</h3>
            <ul className="mt-2 space-y-1.5 text-xs text-ink-600">
              {events.map((ev) => (
                <li key={ev.id} className="flex flex-wrap gap-x-2">
                  <span className="font-mono text-ink-400">{formatDateTime(ev.createdAt)}</span>
                  <span><strong>{ev.fromStatus || "—"}</strong> → <strong>{ev.toStatus}</strong></span>
                  {ev.note ? <span className="italic">“{ev.note}”</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="-m-4">
        <OrderConfirmation order={summary} isNew={false} />
      </div>
    </div>
  );
}
