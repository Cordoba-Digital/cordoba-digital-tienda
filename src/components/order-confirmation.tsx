"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ProductImg } from "@/components/product-img";
import { useStore } from "@/components/store-provider";
import { money } from "@/lib/format";
import { ORDER_STATUS_FLOW, statusIndex } from "@/lib/pricing";

export type OrderSummary = {
  code: string;
  status: string;
  customerName: string;
  email: string;
  phone: string;
  deliveryMethod: string;
  deliveryLabel: string;
  deliveryEta: string;
  address: { street: string; number: string; extra: string; city: string; province: string; zip: string } | null;
  paymentMethod: string;
  paymentLabel: string;
  installments: number;
  subtotal: number;
  discount: number;
  paymentAdjustment: number;
  shippingCost: number;
  total: number;
  couponCode: string | null;
  notes: string;
  createdAt: string;
  items: { name: string; image: string; unitPrice: number; quantity: number; productSlug: string }[];
};

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        } catch {
          /* ignore */
        }
      }}
      className="rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-[11px] font-bold text-ink-600 transition hover:border-brand-300 hover:text-brand-700"
    >
      {copied ? "¡Copiado!" : (label ?? "Copiar")}
    </button>
  );
}

export function OrderConfirmation({ order, isNew }: { order: OrderSummary; isNew: boolean }) {
  const { clearCart } = useStore();
  const current = statusIndex(order.status);

  useEffect(() => {
    if (isNew) clearCart();
  }, [isNew, clearCart]);

  const needsPayment = order.paymentMethod === "transferencia";

  return (
    <div className="container-xl py-8">
      {isNew ? (
        <div className="mb-6 animate-rise overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-500 to-emerald-400 p-6 text-white md:p-8">
          <div className="flex flex-wrap items-center gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/20 text-3xl">âœ“</span>
            <div>
              <h1 className="text-2xl font-black md:text-3xl">¡Gracias {order.customerName.split(" ")[0]}! Tu pedido está confirmado</h1>
              <p className="mt-1 text-sm text-emerald-50">
                Te enviamos el detalle a <strong>{order.email}</strong>. También podés seguirlo desde acá cuando quieras.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <section className="card-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-ink-400">Número de pedido</p>
                <p className="text-2xl font-black tracking-tight text-ink-900">{order.code}</p>
                <p className="text-xs text-ink-400">Realizado el {order.createdAt}</p>
              </div>
              <div className="flex gap-2">
                <CopyButton value={order.code} label="Copiar código" />
                <Link
                  href={`/seguimiento?codigo=${order.code}`}
                  className="rounded-lg bg-ink-900 px-3 py-1.5 text-[11px] font-bold text-white"
                >
                  Seguir pedido
                </Link>
              </div>
            </div>
          </section>

          <section className="card-surface p-5">
            <h2 className="mb-4 text-lg font-extrabold text-ink-900">Estado del pedido</h2>
            <ol className="space-y-4">
              {ORDER_STATUS_FLOW.map((stage, index) => {
                const done = index <= current;
                return (
                  <li key={stage.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${
                          done ? "bg-emerald-500 text-white" : "bg-ink-100 text-ink-400"
                        }`}
                      >
                        {done ? "âœ“" : index + 1}
                      </span>
                      {index < ORDER_STATUS_FLOW.length - 1 ? (
                        <span className={`mt-1 h-8 w-0.5 ${index < current ? "bg-emerald-400" : "bg-ink-100"}`} />
                      ) : null}
                    </div>
                    <div className="pb-1">
                      <p className={`text-sm font-bold ${done ? "text-ink-900" : "text-ink-400"}`}>{stage.label}</p>
                      <p className="text-xs text-ink-500">{stage.description}</p>
                      {index === current ? (
                        <span className="mt-1 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">
                          Estado actual
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          {needsPayment ? (
            <section className="card-surface border-2 border-amber-200 bg-amber-50/40 p-5">
              <h2 className="text-lg font-extrabold text-ink-900">ðŸ’¸ Cómo completar tu pago</h2>
              <p className="mt-1 text-sm text-ink-600">
                Transferí <strong>{money(order.total)}</strong> a cualquiera de estas cuentas. Reservamos tu stock por 48 hs.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-ink-100 bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-ink-400">Transferencia bancaria</p>
                  <dl className="mt-2 space-y-1.5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-ink-500">CBU</dt>
                      <dd className="flex items-center gap-2 font-semibold text-ink-900">
                        0070123430004012345678
                        <CopyButton value="0070123430004012345678" />
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-ink-500">Alias</dt>
                      <dd className="flex items-center gap-2 font-semibold text-ink-900">
                        CORDOBA.DIGITAL.AR
                        <CopyButton value="CORDOBA.DIGITAL.AR" />
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-ink-500">Titular</dt>
                      <dd className="font-semibold text-ink-900">Córdoba Digital SRL</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-ink-500">CUIT</dt>
                      <dd className="font-semibold text-ink-900">30-71234567-9</dd>
                    </div>
                  </dl>
                </div>
                <div className="rounded-xl border border-ink-100 bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-ink-400">USDT (red TRC-20)</p>
                  <p className="mt-2 break-all text-sm font-semibold text-ink-900">TQn9Y2khDD95J42FQtQTdwVVR93o7cCbPo</p>
                  <div className="mt-2">
                    <CopyButton value="TQn9Y2khDD95J42FQtQTdwVVR93o7cCbPo" label="Copiar wallet" />
                  </div>
                  <p className="mt-3 text-[11px] text-ink-400">
                    Cotización del día informada por WhatsApp al momento de la transferencia.
                  </p>
                </div>
              </div>
              <a
                href={`https://wa.me/5493516777774?text=${encodeURIComponent(
                  `Hola! Envío el comprobante del pedido ${order.code}`,
                )}`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-600"
              >
                ðŸ“Ž Enviar comprobante por WhatsApp
              </a>
            </section>
          ) : null}

          <section className="card-surface p-5">
            <h2 className="mb-4 text-lg font-extrabold text-ink-900">Productos</h2>
            <div className="space-y-3">
              {order.items.map((item) => (
                <div key={item.productSlug} className="flex items-center gap-3">
                  <ProductImg
                    src={item.image}
                    alt=""
                    sizes="56px"
                    width={56}
                    height={56}
                    className="h-14 w-14 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <Link href={`/producto/${item.productSlug}`} className="line-clamp-1 text-sm font-semibold text-ink-800 hover:text-brand-700">
                      {item.name}
                    </Link>
                    <p className="text-xs text-ink-400">
                      {item.quantity} x {money(item.unitPrice)}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-ink-900">{money(item.unitPrice * item.quantity)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="card-surface p-5">
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-ink-400">Entrega</h3>
              <p className="mt-2 text-sm font-bold text-ink-900">{order.deliveryLabel}</p>
              <p className="text-xs text-emerald-600">{order.deliveryEta}</p>
              {order.address ? (
                <p className="mt-2 text-sm text-ink-600">
                  {order.address.street} {order.address.number} {order.address.extra}
                  <br />
                  {order.address.city}, {order.address.province} (CP {order.address.zip})
                </p>
              ) : (
                <p className="mt-2 text-sm text-ink-600">27 de Abril 259, Córdoba Capital</p>
              )}
              {order.notes ? <p className="mt-2 text-xs italic text-ink-400">â€œ{order.notes}â€</p> : null}
            </div>
            <div className="card-surface p-5">
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-ink-400">Pago</h3>
              <p className="mt-2 text-sm font-bold text-ink-900">{order.paymentLabel}</p>
              {order.installments > 1 ? (
                <p className="text-xs text-ink-500">
                  {order.installments} cuotas de {money(Math.round(order.total / order.installments))}
                </p>
              ) : null}
              <p className="mt-2 text-xs text-ink-500">Facturamos a nombre de {order.customerName}.</p>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="card-surface sticky top-36 space-y-3 p-5">
            <h2 className="text-lg font-extrabold text-ink-900">Resumen</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between text-ink-600">
                <dt>Subtotal</dt>
                <dd>{money(order.subtotal)}</dd>
              </div>
              {order.discount > 0 ? (
                <div className="flex justify-between text-emerald-600">
                  <dt>Cupón {order.couponCode}</dt>
                  <dd>-{money(order.discount)}</dd>
                </div>
              ) : null}
              {order.paymentAdjustment !== 0 ? (
                <div className={`flex justify-between ${order.paymentAdjustment < 0 ? "text-emerald-600" : "text-ink-600"}`}>
                  <dt>{order.paymentAdjustment < 0 ? "Descuento medio de pago" : "Financiación"}</dt>
                  <dd>
                    {order.paymentAdjustment < 0 ? "-" : "+"}
                    {money(Math.abs(order.paymentAdjustment))}
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between text-ink-600">
                <dt>Envío</dt>
                <dd>{order.shippingCost === 0 ? "Gratis" : money(order.shippingCost)}</dd>
              </div>
            </dl>
            <div className="flex items-end justify-between border-t border-ink-100 pt-3">
              <span className="text-sm font-semibold text-ink-600">Total</span>
              <span className="text-2xl font-black text-ink-900">{money(order.total)}</span>
            </div>
            <Link
              href="/productos"
              className="block w-full rounded-xl bg-ink-900 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-brand-700"
            >
              Seguir comprando
            </Link>
            <a
              href="https://wa.me/5493516777774"
              target="_blank"
              rel="noreferrer"
              className="block w-full rounded-xl border border-ink-200 px-4 py-2.5 text-center text-xs font-bold text-ink-700 transition hover:border-emerald-300 hover:text-emerald-700"
            >
              ¿Necesitás ayuda? Escribinos
            </a>
            <p className="text-center text-[11px] text-ink-400">
              Guardá el código <strong>{order.code}</strong> para consultar el estado cuando quieras.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
