"use client";

import { Check, CircleCheck, Copy, CreditCard, Landmark, MessageCircle, Paperclip, Store, Truck, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ProductImg } from "@/components/product-img";
import { useStore } from "@/components/store-provider";
import { TransferDetails } from "@/components/transfer-details";
import { trackPurchase } from "@/lib/analytics";
import { money } from "@/lib/format";
import { orderBanner, orderCodeLabel } from "@/lib/order-banner";
import { isCancelled, ORDER_STATUS_FLOW, statusIndex } from "@/lib/pricing";
import type { TransferAccount } from "@/lib/transfer-account";

export type OrderSummary = {
  code: string;
  status: string;
  customerName: string;
  email: string;
  phone: string;
  deliveryMethod: string;
  deliveryLabel: string;
  deliveryEta: string;
  address: {
    street: string;
    number: string;
    extra: string;
    city: string;
    province: string;
    zip: string;
    sucursal?: { codigo: string; nombre: string; direccion: string };
  } | null;
  /** Número de seguimiento de Andreani, cuando ya lo hay. */
  trackingCode?: string;
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

export function OrderConfirmation({
  order,
  isNew,
  paymentReturn,
  transfer,
}: {
  order: OrderSummary;
  isNew: boolean;
  /** Cuenta para transferir (`lib/transfer-account`); null si no está configurada. */
  transfer: TransferAccount | null;
  /** `?pago=` con el que vuelve Mercado Pago (exito, pendiente, fallo) o `error` si no se pudo iniciar. */
  paymentReturn?: string;
}) {
  const { clearCart } = useStore();
  const current = statusIndex(order.status);

  useEffect(() => {
    if (isNew) clearCart();
  }, [isNew, clearCart]);

  // `purchase` solo en la confirmación recién creada (`?nuevo=1`). Una recarga
  // de esa misma URL no lo repite: GA4 descarta igual los `transaction_id`
  // duplicados, pero así tampoco se ensucia el conteo de eventos.
  useEffect(() => {
    if (!isNew) return;
    const key = `cd_ga_purchase_${order.code}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      /* sin sessionStorage: lo mandamos igual */
    }
    trackPurchase({
      transactionId: order.code,
      value: order.total,
      shipping: order.shippingCost,
      coupon: order.couponCode,
      items: order.items.map((item) => ({
        item_id: item.productSlug,
        item_name: item.name,
        price: item.unitPrice,
        quantity: item.quantity,
      })),
    });
  }, [isNew, order]);

  const needsPayment = order.paymentMethod === "transferencia" && order.status === "pendiente_pago";
  const banner = orderBanner(order);
  const codeLabel = orderCodeLabel(order.status);
  const awaitingMercadoPago = order.paymentMethod === "mercadopago" && order.status === "pendiente_pago";
  // Mientras falta el pago no va aviso arriba: lo que falta ya lo dicen el
  // estado ("Reserva creada") y la tarjeta de cómo pagar, y el aviso ámbar
  // empujaba todo para abajo. El aviso queda para el pedido ya confirmado.
  const showBanner = isNew && banner.tone === "confirmado";
  const CodeHeading = showBanner ? "p" : "h1";

  return (
    <div className="container-xl py-8 md:py-10">
      {showBanner ? (
        <div className="mb-6 animate-rise overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-600 to-emerald-500 p-6 text-white md:p-8">
          <div className="flex flex-wrap items-center gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/20" aria-hidden>
              <CircleCheck className="h-8 w-8" strokeWidth={2.25} />
            </span>
            <div>
              <h1 className="text-2xl font-black md:text-3xl">{banner.title}</h1>
              <p className="mt-1 text-sm text-emerald-50">
                Guardá tu {codeLabel.label.toLowerCase()}, <strong>{order.code}</strong>: con él podés seguirlo desde acá cuando quieras.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <section className="card-surface p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-ink-500">{codeLabel.label}</p>
                <CodeHeading className="mt-0.5 text-2xl font-black tracking-tight text-ink-900 md:text-3xl">
                  {order.code}
                </CodeHeading>
                <p className="mt-1 text-xs text-ink-500">Realizado el {order.createdAt}</p>
              </div>
              <div className="flex w-full gap-2 sm:w-auto">
                <CopyCodeButton value={order.code} />
                <Link
                  href={`/seguimiento?codigo=${order.code}`}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-bold text-white transition hover:bg-brand-800 sm:flex-none"
                >
                  <Truck className="h-4 w-4" aria-hidden />
                  Seguir pedido
                </Link>
              </div>
            </div>
          </section>

          <section className="card-surface p-5 md:p-6">
            <h2 className="mb-5 text-lg font-extrabold text-ink-900">Estado del pedido</h2>
            {isCancelled(order.status) ? (
              <p className="rounded-xl bg-ink-50 px-4 py-3 text-sm font-semibold text-ink-700">
                Este pedido está cancelado: venció la reserva de 48 hs sin pago o lo cancelamos a pedido. Si ya
                pagaste o querés retomarlo, escribinos por WhatsApp con el número de pedido.
              </p>
            ) : (
              <ol>
                {ORDER_STATUS_FLOW.map((stage, index) => {
                  const done = index <= current;
                  const isCurrent = index === current;
                  const last = index === ORDER_STATUS_FLOW.length - 1;
                  return (
                    <li key={stage.id} className="flex gap-4" aria-current={isCurrent ? "step" : undefined}>
                      <div className="flex flex-col items-center">
                        <span
                          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${
                            done ? "bg-emerald-700 text-white" : "border border-ink-200 bg-surface text-ink-500"
                          } ${isCurrent ? "ring-4 ring-emerald-100" : ""}`}
                        >
                          {done ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden /> : index + 1}
                        </span>
                        {last ? null : (
                          <span
                            className={`my-1 w-0.5 flex-1 rounded-full ${index < current ? "bg-emerald-500" : "bg-ink-100"}`}
                            aria-hidden
                          />
                        )}
                      </div>
                      <div className={`min-w-0 pt-1 ${last ? "" : "pb-6"}`}>
                        <p className={`flex flex-wrap items-center gap-2 text-sm font-bold ${done ? "text-ink-900" : "text-ink-500"}`}>
                          {stage.label}
                          {isCurrent ? (
                            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">
                              Estado actual
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-sm text-ink-500">{stage.description}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {awaitingMercadoPago ? <MercadoPagoPanel code={order.code} total={order.total} paymentReturn={paymentReturn} /> : null}

          {needsPayment ? (
            <section className="card-surface border border-amber-200 bg-amber-50/50 p-5 md:p-6">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800" aria-hidden>
                  <Landmark className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-lg font-extrabold text-ink-900">Cómo completar tu pago</h2>
                  {transfer ? (
                    <p className="mt-0.5 text-sm text-ink-600">
                      Transferí <strong>{money(order.total)}</strong> a esta cuenta y mandanos el comprobante.
                    </p>
                  ) : (
                    <p className="mt-0.5 text-sm text-ink-600">
                      Escribinos por WhatsApp con tu código de reserva y te pasamos los datos para transferir{" "}
                      <strong>{money(order.total)}</strong>.
                    </p>
                  )}
                </div>
              </div>
              {transfer ? (
                <div className="mt-4">
                  <TransferDetails account={transfer} amount={order.total} />
                </div>
              ) : null}
              <a
                href={`https://wa.me/5493516777774?text=${encodeURIComponent(
                  transfer
                    ? `Hola! Envío el comprobante del pedido ${order.code}`
                    : `Hola! Quiero los datos para transferir el pedido ${order.code}`,
                )}`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white transition hover:bg-emerald-600 sm:w-auto"
              >
                {transfer ? <Paperclip className="h-4 w-4" aria-hidden /> : <MessageCircle className="h-4 w-4" aria-hidden />}
                {transfer ? "Enviar comprobante por WhatsApp" : "Pedir los datos por WhatsApp"}
              </a>
            </section>
          ) : null}

          <section className="card-surface p-5 md:p-6">
            <h2 className="mb-4 text-lg font-extrabold text-ink-900">Productos</h2>
            <ul className="divide-y divide-ink-100">
              {order.items.map((item) => (
                <li key={item.productSlug} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-ink-100 bg-white">
                    <ProductImg
                      src={item.image}
                      alt=""
                      sizes="64px"
                      width={64}
                      height={64}
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/producto/${item.productSlug}`} className="line-clamp-2 text-sm font-semibold text-ink-800 hover:text-brand-700">
                      {item.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-ink-500 tabular-nums">
                      {item.quantity} × {money(item.unitPrice)}
                    </p>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-sm font-bold text-ink-900 tabular-nums">
                    {money(item.unitPrice * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="grid gap-5 md:grid-cols-2">
            <div className="card-surface p-5 md:p-6">
              <h3 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-ink-500">
                {order.address ? <Truck className="h-4 w-4" aria-hidden /> : <Store className="h-4 w-4" aria-hidden />}
                Entrega
              </h3>
              <p className="mt-3 text-sm font-bold text-ink-900">{order.deliveryLabel}</p>
              <p className="text-xs font-semibold text-emerald-700">{order.deliveryEta}</p>
              {order.address?.sucursal ? (
                <p className="mt-2 text-sm text-ink-600">
                  Retirás en <strong>{order.address.sucursal.nombre}</strong>
                  {order.address.sucursal.direccion ? ` · ${order.address.sucursal.direccion}` : ""}
                </p>
              ) : null}
              {order.trackingCode ? (
                <p className="mt-2 text-sm text-ink-600">
                  Seguimiento:{" "}
                  <a
                    href={`https://www.andreani.com/envio/${encodeURIComponent(order.trackingCode)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-brand-700 hover:underline"
                  >
                    {order.trackingCode}
                  </a>
                </p>
              ) : null}
              {order.address ? (
                <p className="mt-2 text-sm text-ink-600">
                  {order.address.street ? (
                    <>
                      {order.address.street} {order.address.number} {order.address.extra}
                      <br />
                    </>
                  ) : null}
                  {order.address.city}, {order.address.province} (CP {order.address.zip})
                </p>
              ) : (
                <p className="mt-2 text-sm text-ink-600">27 de Abril 180, Córdoba Capital</p>
              )}
              {order.notes ? <p className="mt-2 text-xs italic text-ink-500">“{order.notes}”</p> : null}
            </div>
            <div className="card-surface p-5 md:p-6">
              <h3 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-ink-500">
                <Wallet className="h-4 w-4" aria-hidden />
                Pago
              </h3>
              <p className="mt-3 text-sm font-bold text-ink-900">{order.paymentLabel}</p>
              {order.installments > 1 ? (
                <p className="text-xs text-ink-500">
                  {order.installments} cuotas de {money(Math.round(order.total / order.installments))}
                </p>
              ) : null}
              <p className="mt-2 text-sm text-ink-600">Facturamos a nombre de {order.customerName}.</p>
            </div>
          </section>
        </div>

        {/* El header es sticky y mide 148 px en escritorio: con `top-36` el
            resumen se metía abajo. `top-47` (188 px) es donde arranca la
            tarjeta, así que al bajar queda quieta con el mismo aire de arriba. */}
        <aside className="lg:sticky lg:top-47">
          <div className="card-surface space-y-4 p-5 md:p-6">
            <h2 className="text-lg font-extrabold text-ink-900">Resumen</h2>
            <dl className="space-y-2.5 text-sm tabular-nums">
              <div className="flex justify-between text-ink-600">
                <dt>Subtotal</dt>
                <dd>{money(order.subtotal)}</dd>
              </div>
              {order.discount > 0 ? (
                <div className="flex justify-between text-emerald-700">
                  <dt>Cupón {order.couponCode}</dt>
                  <dd>-{money(order.discount)}</dd>
                </div>
              ) : null}
              {order.paymentAdjustment !== 0 ? (
                <div className={`flex justify-between ${order.paymentAdjustment < 0 ? "text-emerald-700" : "text-ink-600"}`}>
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
            <div className="flex items-baseline justify-between border-t border-ink-100 pt-4">
              <span className="text-sm font-semibold text-ink-600">Total</span>
              <span className="text-2xl font-black text-ink-900 tabular-nums">{money(order.total)}</span>
            </div>
            <Link
              href="/productos"
              className="flex h-12 w-full items-center justify-center rounded-xl bg-brand-700 px-4 text-sm font-bold text-white transition hover:bg-brand-800"
            >
              Seguir comprando
            </Link>
            <a
              href="https://wa.me/5493516777774"
              target="_blank"
              rel="noreferrer"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-ink-200 px-4 text-sm font-bold text-ink-700 transition hover:border-emerald-300 hover:text-emerald-700"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              ¿Necesitás ayuda? Escribinos
            </a>
            <p className="text-center text-xs leading-relaxed text-ink-500">
              Guardá el código <strong className="text-ink-700">{order.code}</strong> para consultar el estado cuando quieras.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Copiar el código, del mismo alto que "Seguir pedido" que va al lado. */
function CopyCodeButton({ value }: { value: string }) {
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
          /* sin portapapeles: no hacemos nada */
        }
      }}
      className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-ink-200 bg-surface px-4 text-sm font-bold text-ink-700 transition hover:border-brand-300 hover:text-brand-700 sm:flex-none"
    >
      {copied ? <Check className="h-4 w-4 text-emerald-700" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      <span aria-live="polite">{copied ? "¡Copiado!" : "Copiar código"}</span>
    </button>
  );
}

/**
 * Pedido de Mercado Pago que todavía no se acreditó. Si el cliente vuelve de
 * MP con el pago aprobado, el webhook puede tardar unos segundos: la página se
 * refresca sola hasta que el estado cambia. Si no pagó (o falló), puede
 * reintentar desde acá.
 */
function MercadoPagoPanel({ code, total, paymentReturn }: { code: string; total: number; paymentReturn?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirming = paymentReturn === "exito";

  useEffect(() => {
    if (!confirming) return;
    let tries = 0;
    const id = window.setInterval(() => {
      tries += 1;
      router.refresh();
      if (tries >= 12) window.clearInterval(id);
    }, 5000);
    return () => window.clearInterval(id);
  }, [confirming, router]);

  const pay = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout/mercadopago", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (data.ok && data.init_point) {
        window.location.assign(data.init_point);
        return;
      }
      setError(data.error ?? "No pudimos iniciar el pago. Probá de nuevo.");
    } catch {
      setError("No pudimos iniciar el pago. Probá de nuevo.");
    }
    setLoading(false);
  };

  return (
    <section className="card-surface border border-sky-200 bg-sky-50/50 p-5 md:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-100 text-sky-800" aria-hidden>
          <CreditCard className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold text-ink-900">
            {confirming ? "Estamos confirmando tu pago" : paymentReturn === "pendiente" ? "Tu pago está pendiente" : "Falta el pago"}
          </h2>
          <p className="mt-0.5 text-sm text-ink-600">
            {confirming
              ? "Mercado Pago nos está avisando del cobro. En unos segundos el pedido pasa a “Pago acreditado”."
              : paymentReturn === "pendiente"
                ? "Mercado Pago todavía no acreditó el pago (por ejemplo, si elegiste pagar en efectivo). Cuando se acredite, el pedido se actualiza solo."
                : paymentReturn === "fallo"
                  ? "El pago no se completó. Podés intentarlo de nuevo con otra tarjeta o medio."
                  : `Pagá ${money(total)} con Mercado Pago para confirmar el pedido.`}
          </p>
        </div>
      </div>
      {confirming ? null : (
        <button
          type="button"
          onClick={pay}
          disabled={loading}
          aria-busy={loading}
          className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-sky-700 px-5 text-sm font-bold text-white transition hover:bg-sky-800 disabled:opacity-60 sm:w-auto"
        >
          {loading ? "Abriendo Mercado Pago…" : `Pagar ${money(total)} con Mercado Pago`}
        </button>
      )}
      {error ? <p className="mt-2 text-sm font-semibold text-red-700">{error}</p> : null}
    </section>
  );
}
