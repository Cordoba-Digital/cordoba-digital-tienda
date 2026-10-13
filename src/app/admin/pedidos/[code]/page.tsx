import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AdminCopyButton } from "@/components/admin-copy-button";
import { AdminOrderAndreani } from "@/components/admin-order-andreani";
import { AdminOrderManageForm } from "@/components/admin-order-manage-form";
import { AdminOrderNextStep } from "@/components/admin-order-next-step";
import { ProductImg } from "@/components/product-img";
import { Pill } from "@/components/ui";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { allowedStatuses, nextStep, statusSteps, whatsappHref } from "@/lib/admin-order-helpers";
import { getAdminOrderDetail } from "@/lib/admin-orders";
import { verifyAdminSessionValue } from "@/lib/admin-session";
import { andreaniConfigurado } from "@/lib/andreani";
import { isAutomationOn } from "@/lib/automations";
import { formatAgo, formatDateTime, money } from "@/lib/format";
import { isCancelled, statusIndex, statusLabel } from "@/lib/pricing";

export const dynamic = "force-dynamic";

function Card({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="admin-card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-ink-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-sm">
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-right text-ink-900">{children}</dd>
    </div>
  );
}

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const jar = await cookies();
  const { code } = await params;
  if (!(await verifyAdminSessionValue(jar.get(ADMIN_COOKIE)?.value))) {
    redirect(`/admin/login?next=/admin/pedidos/${encodeURIComponent(code)}`);
  }

  const result = await getAdminOrderDetail(decodeURIComponent(code));
  if (!result) notFound();
  const { order, items, events } = result;
  const notifiesCustomer = await isAutomationOn("avisarCliente");

  const step = nextStep(order);
  const cancelled = isCancelled(order.status);
  const canCancel = !cancelled && statusIndex(order.status) < statusIndex("enviado");
  const firstName = order.customerName.split(" ")[0];
  const wa = whatsappHref(order.phone, `Hola ${firstName}! Te escribimos de Córdoba Digital por tu pedido ${order.code}.`);
  const units = items.reduce((sum, item) => sum + item.quantity, 0);
  const address = order.address;

  return (
    <div className="space-y-5">
      <Link href="/admin/pedidos" className="text-sm font-bold text-brand-700 hover:underline">← Volver a pedidos</Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-700">Admin · Pedido</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-ink-900 sm:text-3xl">{order.code}</h1>
            <AdminCopyButton value={order.code} label="Copiar código" />
          </div>
          <p className="mt-1 text-sm text-ink-500">
            {order.customerName} · {formatDateTime(order.createdAt)} ({formatAgo(order.createdAt)})
          </p>
        </div>
        <div className="sm:text-right">
          <p className="text-2xl font-black text-ink-900">{money(order.total)}</p>
          <p className="text-xs text-ink-500">{units} {units === 1 ? "unidad" : "unidades"} · {order.paymentLabel || order.paymentMethod}</p>
        </div>
      </div>

      <section className="admin-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-ink-900">Estado del pedido</h2>
          <Pill solid tone={cancelled ? "neutral" : order.status === "pendiente_pago" ? "amber" : order.status === "entregado" || order.status === "enviado" ? "success" : "brand"}>
            {statusLabel(order.status)}
          </Pill>
        </div>
        <ol className="mt-4 grid gap-2 sm:grid-cols-5">
          {statusSteps(order.status).map((s, i) => (
            <li key={s.id} className="flex items-center gap-2 sm:flex-col sm:items-start">
              <span
                className={`h-1.5 w-8 shrink-0 rounded-full sm:w-full ${s.state === "done" ? "bg-emerald-500" : s.state === "current" ? "bg-ink-900" : "bg-ink-100"}`}
                aria-hidden
              />
              <span className={`text-xs ${s.state === "current" ? "font-bold text-ink-900" : s.state === "done" ? "text-ink-600" : "text-ink-400"}`}>
                {i + 1}. {s.label}
                {s.state === "current" ? <span className="sr-only"> (estado actual)</span> : null}
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-5 border-t border-ink-100 pt-4">
          <AdminOrderNextStep
            code={order.code}
            step={step}
            trackingCode={order.trackingCode ?? ""}
            canCancel={canCancel}
            notifiesCustomer={notifiesCustomer}
          />
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Card title={`Productos (${units})`}>
            <ul className="divide-y divide-ink-50">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-3 first:pt-0">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white">
                    <ProductImg src={item.image} alt="" sizes="56px" className="h-full w-full object-contain" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/productos/${item.productSlug}`} className="font-semibold text-ink-900 hover:text-brand-700 hover:underline">
                      {item.name}
                    </Link>
                    <p className="text-xs text-ink-500">
                      {item.quantity} × {money(item.unitPrice)}
                    </p>
                  </div>
                  <p className="shrink-0 font-bold text-ink-900">{money(item.unitPrice * item.quantity)}</p>
                </li>
              ))}
            </ul>
            <dl className="mt-3 border-t border-ink-100 pt-3">
              <Row label="Subtotal">{money(order.subtotal)}</Row>
              {order.discount ? <Row label={order.couponCode ? `Cupón ${order.couponCode}` : "Descuento"}>−{money(order.discount)}</Row> : null}
              {order.paymentAdjustment ? (
                <Row label={order.paymentAdjustment < 0 ? "Descuento por medio de pago" : "Recargo por medio de pago"}>
                  {order.paymentAdjustment < 0 ? "−" : "+"}{money(Math.abs(order.paymentAdjustment))}
                </Row>
              ) : null}
              <Row label="Envío">{order.shippingCost ? money(order.shippingCost) : "Sin cargo"}</Row>
              <div className="mt-1 flex justify-between gap-3 border-t border-ink-100 pt-2 text-base font-black text-ink-900">
                <span>Total</span>
                <span>{money(order.total)}</span>
              </div>
            </dl>
          </Card>

          <AdminOrderAndreani
            code={order.code}
            deliveryMethod={order.deliveryMethod}
            address={order.address ?? null}
            andreani={order.andreani ?? null}
            trackingCode={order.trackingCode ?? ""}
            status={order.status}
            configurado={andreaniConfigurado()}
          />

          <Card title="Historial">
            <ol className="space-y-2.5 text-sm">
              {events.map((ev) => (
                <li key={ev.id} className="flex flex-col gap-x-3 sm:flex-row">
                  <span className="w-36 shrink-0 text-xs tabular-nums text-ink-400">{formatDateTime(ev.createdAt)}</span>
                  <span className="text-ink-800">
                    {ev.fromStatus === ev.toStatus ? "Nota" : <>Pasó a <strong>{statusLabel(ev.toStatus)}</strong></>}
                    {ev.note ? <span className="text-ink-500"> · {ev.note}</span> : null}
                  </span>
                </li>
              ))}
              <li className="flex flex-col gap-x-3 sm:flex-row">
                <span className="w-36 shrink-0 text-xs tabular-nums text-ink-400">{formatDateTime(order.createdAt)}</span>
                <span className="text-ink-800">Pedido creado en la tienda</span>
              </li>
            </ol>
          </Card>

          <details className="admin-card group p-5">
            <summary className="cursor-pointer list-none text-sm font-bold text-ink-900">
              <span className="inline-block transition-transform group-open:rotate-90" aria-hidden>›</span> Cambiar a mano (estado, seguimiento o nota interna)
            </summary>
            <div className="mt-4">
              <AdminOrderManageForm
                code={order.code}
                currentStatus={order.status}
                trackingCode={order.trackingCode ?? ""}
                statuses={allowedStatuses(order.status)}
              />
            </div>
          </details>
        </div>

        {/* En el celular, el cliente va primero: es lo que más se usa (WhatsApp, dirección). */}
        <div className="order-first space-y-5 lg:order-none">
          <Card title="Cliente">
            <p className="font-semibold text-ink-900">{order.customerName}</p>
            {order.docId ? <p className="text-xs text-ink-500">DNI/CUIT {order.docId}</p> : null}
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <a href={`mailto:${order.email}?subject=${encodeURIComponent(`Tu pedido ${order.code}`)}`} className="min-w-0 truncate text-brand-700 hover:underline">
                  {order.email}
                </a>
                <AdminCopyButton value={order.email} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <a href={`tel:${order.phone.replace(/[^0-9+]/g, "")}`} className="text-ink-900 hover:underline">{order.phone}</a>
                <AdminCopyButton value={order.phone} />
              </div>
            </div>
            {wa ? (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex w-full items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
              >
                Escribirle por WhatsApp
              </a>
            ) : null}
            <Link href={`/admin/pedidos?q=${encodeURIComponent(order.email)}`} className="mt-3 block text-xs font-semibold text-ink-500 hover:text-ink-900 hover:underline">
              Ver sus otros pedidos →
            </Link>
          </Card>

          <Card title="Entrega">
            <p className="font-semibold text-ink-900">{order.deliveryLabel || order.deliveryMethod}</p>
            {order.deliveryEta ? <p className="text-xs text-ink-500">{order.deliveryEta}</p> : null}
            {address?.sucursal?.nombre ? (
              <p className="mt-2 text-sm text-ink-700">
                Sucursal {address.sucursal.nombre}
                <br />
                <span className="text-ink-500">{address.sucursal.direccion}</span>
              </p>
            ) : address?.street ? (
              <div className="mt-2 flex items-start justify-between gap-2 text-sm text-ink-700">
                <p>
                  {address.street} {address.number}
                  {address.extra ? `, ${address.extra}` : ""}
                  <br />
                  {address.city}, {address.province} (CP {address.zip})
                </p>
                <AdminCopyButton
                  value={`${address.street} ${address.number}${address.extra ? `, ${address.extra}` : ""}, ${address.city}, ${address.province} (CP ${address.zip})`}
                />
              </div>
            ) : order.deliveryMethod === "pickup" ? (
              <p className="mt-2 text-sm text-ink-700">Lo retira en el local.</p>
            ) : null}
            {order.trackingCode ? (
              <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-ink-50 px-3 py-2 text-sm">
                <span>
                  Seguimiento <strong className="font-mono">{order.trackingCode}</strong>
                </span>
                <AdminCopyButton value={order.trackingCode} />
              </div>
            ) : null}
          </Card>

          <Card title="Pago">
            <dl>
              <Row label="Medio">{order.paymentLabel || order.paymentMethod}</Row>
              {order.installments > 1 ? <Row label="Cuotas">{order.installments} de {money(Math.round(order.total / order.installments))}</Row> : null}
              {order.mercadopagoPaymentId ? <Row label="Pago en Mercado Pago"><span className="font-mono text-xs">{order.mercadopagoPaymentId}</span></Row> : null}
            </dl>
            {order.paymentMethod === "mercadopago" ? (
              <Link href="/admin/pagos" className="mt-2 block text-xs font-semibold text-ink-500 hover:text-ink-900 hover:underline">
                Ver en Pagos →
              </Link>
            ) : null}
          </Card>

          {order.notes ? (
            <Card title="Nota del cliente">
              <p className="whitespace-pre-line text-sm text-ink-800">{order.notes}</p>
            </Card>
          ) : null}

          <Link href={`/pedido/${order.code}`} target="_blank" className="block text-center text-xs font-semibold text-ink-500 hover:text-ink-900 hover:underline">
            Ver el pedido como lo ve el cliente ↗
          </Link>
        </div>
      </div>
    </div>
  );
}
