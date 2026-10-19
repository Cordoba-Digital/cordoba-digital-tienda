"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { QuantityStepper } from "@/components/cart-drawer";
import { ProductCard } from "@/components/product-card";
import { ProductImg } from "@/components/product-img";
import { useStore } from "@/components/store-provider";
import { ArrowLeft, Banknote, Heart, Landmark, Shield, Store, Ticket, Trash2, Truck } from "lucide-react";
import { money } from "@/lib/format";
import { readCoupon, writeCoupon } from "@/lib/coupon-storage";
import { CHECKOUT_PAYMENT_METHODS } from "@/lib/checkout-payment";
import { couponDiscountFor, MAX_QTY_PER_ITEM, type CouponInfo } from "@/lib/pricing";
import type { ProductView } from "@/lib/product-view";

// Solo los medios que el checkout acepta hoy (`CHECKOUT_PAYMENT_METHODS`): si
// se apaga uno, el carrito deja de ofrecerlo sin tocar este archivo.
const PAY_OPTIONS = [
  { id: "transferencia", title: "Transferencia", detail: "Desde cualquier banco o billetera virtual", Icon: Landmark },
  { id: "efectivo", title: "Efectivo", detail: "Al retirar en el local", Icon: Banknote },
].filter((option) => (CHECKOUT_PAYMENT_METHODS as readonly string[]).includes(option.id));

export function CartView({ suggestions }: { suggestions: ProductView[] }) {
  const { items, setQuantity, removeItem, subtotal, listSubtotal, toggleFavorite, hydrated } = useStore();
  const [coupon, setCoupon] = useState<CouponInfo | null>(null);
  const [code, setCode] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [summaryVisible, setSummaryVisible] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setCoupon(readCoupon()), 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const node = summaryRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setSummaryVisible(entry.isIntersecting), { threshold: 0.2 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [items.length]);

  const applyCoupon = async (event: React.FormEvent) => {
    event.preventDefault();
    setChecking(true);
    setCouponError(null);
    try {
      const res = await fetch("/api/coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, subtotal }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setCouponError(data.error ?? "Cupón inválido");
        setCoupon(null);
        writeCoupon(null);
      } else {
        setCoupon(data.coupon);
        writeCoupon(data.coupon);
        setCode("");
      }
    } finally {
      setChecking(false);
    }
  };

  const discount = couponDiscountFor(subtotal, coupon);
  const savings = Math.max(0, listSubtotal - subtotal);
  const estimatedTotal = Math.max(0, subtotal - discount);

  if (hydrated && items.length === 0) {
    return (
      <div className="container-xl py-16">
        <div className="card-surface mx-auto flex max-w-xl flex-col items-center gap-3 px-8 py-16 text-center">
          <span className="text-6xl">🛒</span>
          <h1 className="text-2xl font-extrabold text-ink-900">Tu carrito está vacío</h1>
          <p className="text-sm text-ink-500">
            Mirá lo más vendido de la semana o escribinos y te ayudamos a elegir el producto ideal.
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-3">
            <Link href="/productos" className="rounded-xl bg-brand-700 px-5 py-3 text-sm font-bold text-white">
              Ver catálogo
            </Link>
            <Link href="/productos?ofertas=1" className="rounded-xl border border-ink-200 px-5 py-3 text-sm font-bold text-ink-700">
              🔥 Ofertas
            </Link>
          </div>
        </div>

        {suggestions.length ? (
          <section className="mt-14">
            <h2 className="mb-5 text-xl font-extrabold text-ink-900">Los más elegidos</h2>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {suggestions.slice(0, 4).map((product) => (
                <ProductCard key={product.slug} product={product} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="container-xl pb-28 pt-6 lg:pb-12 lg:pt-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 md:text-3xl">Tu carrito</h1>
          <p className="mt-1 text-sm text-ink-500">
            {count === 1 ? "1 producto" : `${count} productos`} · Revisá todo y seguí con tus datos, la entrega y el pago.
          </p>
        </div>
        <CartSteps />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
        <div className="space-y-4">
          <div className="card-surface overflow-hidden">
            <ul className="divide-y divide-ink-100">
              {items.map((item) => {
                const itemSavings = item.compareAtPrice ? (item.compareAtPrice - item.price) * item.quantity : 0;
                return (
                  <li key={item.slug} className="flex gap-3 p-4 sm:gap-5 sm:p-5">
                    <Link
                      href={`/producto/${item.slug}`}
                      className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-ink-50 p-2 sm:h-28 sm:w-28 sm:p-3"
                    >
                      <ProductImg
                        src={item.image}
                        srcSet={item.imageSrcSet ?? []}
                        alt={item.name}
                        sizes="112px"
                        width={112}
                        height={112}
                        className="h-full w-full object-contain mix-blend-multiply"
                      />
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">{item.brand}</p>
                          <Link
                            href={`/producto/${item.slug}`}
                            className="line-clamp-2 text-sm font-bold leading-snug text-ink-900 hover:text-brand-700 sm:text-base"
                          >
                            {item.name}
                          </Link>
                        </div>
                        <div className="hidden shrink-0 text-right sm:block">
                          <p className="text-lg font-extrabold text-ink-900">{money(item.price * item.quantity)}</p>
                          {item.quantity > 1 ? <p className="text-xs text-ink-500">{money(item.price)} c/u</p> : null}
                        </div>
                      </div>
                      {itemSavings > 0 ? (
                        <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-ink-400 line-through">{money(item.compareAtPrice! * item.quantity)}</span>
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">
                            Ahorrás {money(itemSavings)}
                          </span>
                        </p>
                      ) : null}
                      <p className="mt-1 text-base font-extrabold text-ink-900 sm:hidden">
                        {money(item.price * item.quantity)}
                        {item.quantity > 1 ? <span className="ml-1.5 text-xs font-medium text-ink-500">{money(item.price)} c/u</span> : null}
                      </p>
                      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 pt-3">
                        <div className="flex items-center gap-1">
                          <QuantityStepper
                            value={item.quantity}
                            max={item.stock > 1 ? Math.min(item.stock, MAX_QTY_PER_ITEM) : MAX_QTY_PER_ITEM}
                            onChange={(q) => setQuantity(item.slug, q)}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              toggleFavorite(item.slug);
                              removeItem(item.slug);
                            }}
                            aria-label={`Guardar para después: ${item.name}`}
                            title="Guardar para después"
                            className="ml-1 inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold text-ink-500 transition hover:bg-ink-50 hover:text-brand-700"
                          >
                            <Heart size={15} aria-hidden />
                            <span className="hidden md:inline">Guardar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeItem(item.slug)}
                            aria-label={`Eliminar: ${item.name}`}
                            title="Eliminar"
                            className="inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold text-ink-500 transition hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 size={15} aria-hidden />
                            <span className="hidden md:inline">Eliminar</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="border-t border-ink-100 bg-ink-50/50 px-4 py-4 sm:px-5">
              {coupon ? (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50 px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Ticket size={18} className="shrink-0 text-emerald-700" aria-hidden />
                    <div>
                      <p className="text-sm font-bold text-emerald-700">{coupon.code} aplicado</p>
                      <p className="text-xs text-emerald-700">{coupon.description}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCoupon(null);
                      writeCoupon(null);
                    }}
                    className="text-xs font-bold text-emerald-700 underline"
                  >
                    Quitar
                  </button>
                </div>
              ) : (
                <form onSubmit={applyCoupon} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <label htmlFor="cupon" className="flex shrink-0 items-center gap-2 text-sm font-bold text-ink-800">
                    <Ticket size={17} className="text-brand-700" aria-hidden />
                    ¿Tenés un cupón?
                  </label>
                  <div className="flex flex-1 gap-2">
                    <input
                      id="cupon"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="Código"
                      autoComplete="off"
                      className="h-10 min-w-0 flex-1 rounded-xl border border-ink-200 bg-surface px-3 text-sm uppercase outline-none placeholder:normal-case placeholder:text-ink-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
                    />
                    <button
                      type="submit"
                      disabled={checking || !code.trim()}
                      className="h-10 rounded-xl border border-ink-900 px-4 text-sm font-bold text-ink-900 transition hover:bg-ink-900 hover:text-white disabled:border-ink-200 disabled:text-ink-400 disabled:hover:bg-transparent"
                    >
                      Aplicar
                    </button>
                  </div>
                </form>
              )}
              {couponError ? <p className="mt-2 text-xs font-semibold text-rose-600">{couponError}</p> : null}
            </div>
          </div>

          <Link
            href="/productos"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-ink-600 transition hover:text-brand-700"
          >
            <ArrowLeft size={16} aria-hidden />
            Seguir comprando
          </Link>
        </div>

        <aside className="lg:sticky lg:top-36">
          <div ref={summaryRef} className="card-surface p-5 sm:p-6">
            <h2 className="text-lg font-extrabold text-ink-900">Resumen de compra</h2>
            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between text-ink-600">
                <dt>Productos ({count})</dt>
                <dd className="font-semibold text-ink-900">{money(listSubtotal)}</dd>
              </div>
              {savings > 0 ? (
                <div className="flex justify-between text-emerald-700">
                  <dt>Descuentos de ofertas</dt>
                  <dd className="font-semibold">-{money(savings)}</dd>
                </div>
              ) : null}
              {discount > 0 ? (
                <div className="flex justify-between text-emerald-700">
                  <dt>Cupón {coupon?.code}</dt>
                  <dd className="font-semibold">-{money(discount)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4 text-ink-600">
                <dt>Envío</dt>
                <dd className="text-right text-ink-500">Se calcula en el checkout</dd>
              </div>
            </dl>
            <div className="mt-4 flex items-end justify-between border-t border-ink-100 pt-4">
              <span className="text-sm font-semibold text-ink-600">Total estimado</span>
              <span className="text-2xl font-black tracking-tight text-ink-900">{money(estimatedTotal)}</span>
            </div>
            {savings + discount > 0 ? (
              <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-center text-xs font-bold text-emerald-700">
                Con esta compra ahorrás {money(savings + discount)}
              </p>
            ) : null}
            <Link
              href="/checkout"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-3.5 text-center text-sm font-extrabold text-white shadow-lg shadow-brand-700/25 transition hover:bg-brand-800"
            >
              Ir a finalizar la compra →
            </Link>

            <div className="mt-5 border-t border-ink-100 pt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-500">Cómo podés pagar</p>
              <ul className="mt-2.5 space-y-2">
                {PAY_OPTIONS.map(({ id, title, detail, Icon }) => (
                  <li key={id} className="flex items-center gap-3 rounded-xl border border-ink-100 px-3 py-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                      <Icon size={17} aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-ink-900">{title}</span>
                      <span className="block text-xs text-ink-500">{detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <ul className="mt-4 space-y-1.5 text-xs text-ink-500">
              <li className="flex items-center gap-2"><Store size={14} aria-hidden /> Retiro gratis en 27 de Abril 180, Córdoba</li>
              <li className="flex items-center gap-2"><Truck size={14} aria-hidden /> Envíos con seguimiento a todo el país</li>
              <li className="flex items-center gap-2"><Shield size={14} aria-hidden /> Garantía oficial en todos los productos</li>
            </ul>
          </div>
        </aside>
      </div>

      {suggestions.length ? (
        <section className="mt-14">
          <h2 className="mb-5 text-xl font-extrabold text-ink-900">Sumá a tu compra</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {suggestions.slice(0, 4).map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>
        </section>
      ) : null}

      {/* En el celular el resumen queda abajo de todo: el total y el botón
          acompañan el scroll hasta que el resumen entra en pantalla. El
          `pr` deja lugar al botón de WhatsApp, como en la ficha. */}
      <div
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-ink-100 bg-surface/95 px-4 py-3 pr-[5.5rem] shadow-[0_-8px_24px_-16px_rgba(10,18,38,0.5)] backdrop-blur transition-transform duration-200 lg:hidden ${
          summaryVisible ? "translate-y-full" : ""
        }`}
        aria-hidden={summaryVisible}
        inert={summaryVisible}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-ink-500">Total estimado</p>
            <p className="text-lg font-black leading-tight text-ink-900">{money(estimatedTotal)}</p>
          </div>
          <Link
            href="/checkout"
            className="ml-auto rounded-xl bg-brand-700 px-5 py-3 text-sm font-extrabold text-white"
          >
            Finalizar compra
          </Link>
        </div>
      </div>
    </div>
  );
}

function CartSteps() {
  const steps = ["Carrito", "Datos", "Entrega", "Pago"];
  return (
    <ol className="flex items-center gap-1.5 text-xs font-semibold text-ink-500" aria-label="Pasos de la compra">
      {steps.map((step, index) => (
        <li key={step} className="flex items-center gap-1.5">
          {index > 0 ? <span className="h-px w-3 bg-ink-300 sm:w-5" aria-hidden /> : null}
          <span
            className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${
              index === 0 ? "bg-brand-700 text-white" : "bg-surface text-ink-500 ring-1 ring-ink-200"
            }`}
            aria-hidden
          >
            {index + 1}
          </span>
          <span className={index === 0 ? "text-ink-900" : undefined} aria-current={index === 0 ? "step" : undefined}>
            {step}
          </span>
        </li>
      ))}
    </ol>
  );
}
