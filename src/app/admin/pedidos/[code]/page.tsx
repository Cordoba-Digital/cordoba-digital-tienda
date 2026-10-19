import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AdminCopyButton } from "@/components/admin-copy-button";
import { AdminOrderAndreani } from "@/components/admin-order-andreani";
import { AdminOrderManageForm } from "@/components/admin-order-manage-form";
import { AdminOrderNextStep } from "@/components/admin-order-next-step";
import { AdminOrderRefunds } from "@/components/admin-order-refunds";
import { AdminOrderReturns } from "@/components/admin-order-returns";
import { ProductImg } from "@/components/product-img";
import { AdminStatusBadge } from "@/components/admin-ui";
import { Pill } from "@/components/ui";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { allowedStatuses, nextStep, statusSteps, whatsappHref } from "@/lib/admin-order-helpers";
import { getAdminOrderDetail } from "@/lib/admin-orders";
import { isOwnerEmail } from "@/lib/admin-access";
import { listOrderRefunds, orderWasPaid } from "@/lib/admin-refunds";
import { listOrderReturns, returnedByItem } from "@/lib/admin-returns";
import { readAdminSession } from "@/lib/admin-session";
import { andreaniConfigurado } from "@/lib/andreani";
import { isAutomationOn } from "@/lib/automations";
import { formatAgo, formatDateTime, money } from "@/lib/format";
import { isCancelled, statusIndex, statusLabel } from "@/lib/pricing";
import { tronscanTxUrl } from "@/lib/tron";
import { usdtShortfall } from "@/lib/usdt-amount";
import { syncUsdtPayment } from "@/lib/usdt-server";

export const dynamic = "force-dynamic";

function Card({ title, action, className = "", children }: { title: string; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={`admin-card p-5 ${className}`}>
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

/* Filas del detalle en escritorio: dos tarjetas de la misma altura. */
const fila = "contents lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-5";
/* Columna derecha de una fila: la última tarjeta ocupa el alto que sobra. */
const pila = "contents lg:flex lg:flex-col lg:gap-5 lg:[&>*:last-child]:flex-1";

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const jar = await cookies();
  const { code } = await params;
  const session = await readAdminSession(jar.get(ADMIN_COOKIE)?.value);
  if (!session) {
    redirect(`/admin/login?next=/admin/pedidos/${encodeURIComponent(code)}`);
  }

  const result = await getAdminOrderDetail(decodeURIComponent(code));
  if (!result) notFound();
  const { order, items, events } = result;
  const [notifiesCustomer, refunds, returns, usdtPayment] = await Promise.all([
    isAutomationOn("avisarCliente"),
    listOrderRefunds(order.id),
    listOrderReturns(order.id),
    order.paymentMethod === "usdt" ? syncUsdtPayment(order).catch(() => null) : null,
  ]);
  const returned = returnedByItem(returns);

  const step = nextStep(order);
  const cancelled = isCancelled(order.status);
  const canCancel = !cancelled && statusIndex(order.status) < statusIndex("enviado");
  const firstName = order.customerName.split(" ")[0];
  const wa = whatsappHref(order.phone, `Hola ${firstName}! Te escribimos de Córdoba Digital por tu pedido ${order.code}.`);
  const units = items.reduce((sum, item) => sum + item.quantity, 0);
  const address = order.address;
  const paid = orderWasPaid(order.status, events.map((e) => e.toStatus));
  const canReturn = order.status === "enviado" || order.status === "entregado";
  // Lo mismo que deciden los componentes para no mostrarse, así la fila sabe qué tarjeta queda última.
  const conAndreani = order.deliveryMethod !== "pickup";
  const conReembolsos = paid || refunds.length > 0;
  const conDevoluciones = canReturn || returns.length > 0;

  return (
    <div className="space-y-5">
      <Link href="/admin/pedidos" className="text-sm font-bold text-brand-700 hover:underline">← Volver a pedidos</Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] text-adm-muted">Pedido</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] text-adm-fg sm:text-[30px]">{order.code}</h1>
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
          <AdminStatusBadge status={order.status} />
        </div>
        <ol className="mt-4 grid gap-2 sm:grid-cols-5">
          {statusSteps(order.status).map((s, i) => (
            <li key={s.id} className="flex items-center gap-2 sm:flex-col sm:items-start">
              <span
                className={`relative h-1.5 w-8 shrink-0 overflow-hidden rounded-full sm:w-full ${s.state === "done" ? "bg-emerald-500" : "bg-ink-100"}`}
                aria-hidden
              >
                {/* El paso en curso se va llenando, una y otra vez, hasta que el pedido avanza. */}
                {s.state === "current" ? <span className="estado-avance absolute inset-0 rounded-full bg-brand-500" /> : null}
              </span>
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

      {/* Escritorio: filas de dos tarjetas con la misma altura (productos con
          cliente, Andreani con entrega, historial con pago). Si la columna de la
          derecha tiene más de una tarjeta, la última se estira hasta el final de
          la fila. En el celular las filas se deshacen (display: contents) y cada
          bloque toma su lugar con `order`: cliente, productos, entrega y pago
          arriba; reembolsos, historial y los cambios a mano al final. */}
      <div className="flex flex-col gap-5">
        <div className={fila}>
            <Card title={`Productos (${units})`} className="order-2 lg:order-none">
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
                  <dt>Total</dt>
                  <dd>{money(order.total)}</dd>
                </div>
              </dl>
            </Card>
          <div className={pila}>
              <Card title="Cliente" className="order-1 lg:order-none">
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
                    className="mt-4 flex w-full items-center justify-center rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800"
                  >
                    Escribirle por WhatsApp
                  </a>
                ) : null}
                <Link href={`/admin/pedidos?q=${encodeURIComponent(order.email)}`} className="mt-3 block text-xs font-semibold text-ink-500 hover:text-ink-900 hover:underline">
                  Ver sus otros pedidos →
                </Link>
              </Card>
              {order.notes ? (
                <Card title="Nota del cliente" className="order-3 lg:order-none">
                  <p className="whitespace-pre-line text-sm text-ink-800">{order.notes}</p>
                </Card>
              ) : null}
          </div>
        </div>

        {conAndreani ? (
          <div className={fila}>
              <div className="order-5 lg:order-none lg:[&>*]:h-full">
              <AdminOrderAndreani
                code={order.code}
                deliveryMethod={order.deliveryMethod}
                address={order.address ?? null}
                andreani={order.andreani ?? null}
                trackingCode={order.trackingCode ?? ""}
                status={order.status}
                configurado={andreaniConfigurado()}
              />
              </div>
            <div className={pila}>
                <Card title="Entrega" className="order-4 lg:order-none">
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
            </div>
          </div>
        ) : null}

        <div className={fila}>
            <Card title="Historial" className="order-9 lg:order-none">
              {/* Línea de tiempo: lo más nuevo arriba, la fecha debajo de cada hecho. */}
              <ol className="text-sm">
                {[
                  ...events.map((ev) => ({
                    key: String(ev.id),
                    at: ev.createdAt,
                    text: ev.fromStatus === ev.toStatus ? <>Nota interna</> : <>Pasó a <strong className="font-semibold">{statusLabel(ev.toStatus)}</strong></>,
                    note: ev.note,
                  })),
                  { key: "creado", at: order.createdAt, text: <>Pedido creado en la tienda</>, note: "" },
                ].map((ev, i, all) => (
                  <li key={ev.key} className="relative flex gap-3 pb-4 last:pb-0">
                    {i < all.length - 1 ? <span className="absolute bottom-0 left-[4px] top-4 w-px bg-ink-100" aria-hidden /> : null}
                    <span className={`mt-1.5 h-[9px] w-[9px] shrink-0 rounded-full ${i === 0 ? "bg-brand-500" : "bg-ink-300"}`} aria-hidden />
                    <div className="min-w-0">
                      <p className="text-ink-800">{ev.text}</p>
                      {ev.note ? <p className="text-ink-500">{ev.note}</p> : null}
                      <p className="mt-0.5 text-xs text-ink-400">{formatDateTime(ev.at)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          <div className={pila}>
            {conAndreani ? null : (
                <Card title="Entrega" className="order-4 lg:order-none">
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
            )}
              <Card title="Pago" className="order-6 lg:order-none">
                <dl>
                  <Row label="Medio">{order.paymentLabel || order.paymentMethod}</Row>
                  {order.installments > 1 ? <Row label="Cuotas">{order.installments} de {money(Math.round(order.total / order.installments))}</Row> : null}
                  {order.mercadopagoPaymentId ? <Row label="Pago en Mercado Pago"><span className="font-mono text-xs">{order.mercadopagoPaymentId}</span></Row> : null}
                  {order.paymentMethod === "usdt" && usdtPayment ? (
                    <>
                      <Row label="A pagar">
                        {usdtPayment.expectedAmount} USDT
                        <span className="block text-xs text-ink-500">Dólar oficial ${Number(usdtPayment.rate).toLocaleString("es-AR")}</span>
                      </Row>
                      <Row label="TXID">
                        {usdtPayment.txid ? (
                          <a href={tronscanTxUrl(usdtPayment.txid)} target="_blank" rel="noreferrer" className="break-all font-mono text-xs hover:underline">
                            {usdtPayment.txid}
                          </a>
                        ) : (
                          <span className="text-ink-500">El cliente todavía no lo cargó</span>
                        )}
                      </Row>
                      {usdtPayment.txid ? (
                        <Row label="En la red">
                          {usdtPayment.transfer ? (
                            usdtShortfall(usdtPayment.transfer.amount, usdtPayment.expectedAmount) === "0" ? (
                              <span className="font-semibold text-emerald-700">Llegaron {usdtPayment.transfer.amount} USDT</span>
                            ) : (
                              <span className="font-semibold text-red-600">
                                Llegaron {usdtPayment.transfer.amount} USDT: faltan{" "}
                                {usdtShortfall(usdtPayment.transfer.amount, usdtPayment.expectedAmount)}
                              </span>
                            )
                          ) : (
                            <span className="text-ink-500">Todavía no aparece en la wallet</span>
                          )}
                        </Row>
                      ) : null}
                    </>
                  ) : null}
                </dl>
                {order.paymentMethod === "mercadopago" ? (
                  <Link href="/admin/pagos" className="mt-2 block text-xs font-semibold text-ink-500 hover:text-ink-900 hover:underline">
                    Ver en Pagos →
                  </Link>
                ) : null}
              </Card>
            {conReembolsos ? (
                <div className="order-7 lg:order-none lg:[&>*]:h-full">
                <AdminOrderRefunds
                  code={order.code}
                  total={order.total}
                  refunds={refunds.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
                  paid={paid}
                  viaMp={order.paymentMethod === "mercadopago"}
                  canRefund={!session.email || isOwnerEmail(session.email)}
                />
                </div>
            ) : null}
            {conDevoluciones ? (
                <div className="order-8 lg:order-none lg:[&>*]:h-full">
                <AdminOrderReturns
                  code={order.code}
                  items={items.map((item) => ({ id: item.id, name: item.name, quantity: item.quantity, returned: returned.get(item.id) ?? 0 }))}
                  returns={returns.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
                  canReturn={canReturn}
                />
                </div>
            ) : null}
          </div>
        </div>

        <div className={`${fila} lg:items-start`}>
            <details className="admin-card group order-10 p-5 lg:order-none">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold text-ink-900 [&::-webkit-details-marker]:hidden">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-500 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 6 6 6-6 6" />
                </svg>
                Cambiar a mano
                <span className="hidden font-normal text-ink-500 sm:inline">estado, seguimiento o nota interna</span>
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
            <Link href={`/pedido/${order.code}`} target="_blank" className="order-11 block text-center text-xs font-semibold text-ink-500 hover:text-ink-900 hover:underline lg:order-none lg:self-center">
              Ver el pedido como lo ve el cliente ↗
            </Link>
        </div>
      </div>
    </div>
  );
}
