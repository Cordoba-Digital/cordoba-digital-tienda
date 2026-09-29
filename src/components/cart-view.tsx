"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { FreeShippingBar, QuantityStepper } from "@/components/cart-drawer";
import { ProductCard } from "@/components/product-card";
import { ProductImg } from "@/components/product-img";
import { useStore } from "@/components/store-provider";
import { money, transferPrice } from "@/lib/format";
import { readCoupon, writeCoupon } from "@/lib/coupon-storage";
import { couponDiscountFor, type CouponInfo } from "@/lib/pricing";
import type { ProductView } from "@/lib/product-view";

export function CartView({ suggestions }: { suggestions: ProductView[] }) {
  const { items, setQuantity, removeItem, subtotal, listSubtotal, toggleFavorite, hydrated } = useStore();
  const [coupon, setCoupon] = useState<CouponInfo | null>(null);
  const [code, setCode] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setCoupon(readCoupon()), 0);
    return () => window.clearTimeout(id);
  }, []);

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
            <Link href="/productos" className="rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white">
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

  return (
    <div className="container-xl py-8">
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-ink-900 md:text-3xl">Tu carrito</h1>
      <p className="mb-6 text-sm text-ink-500">Revisá los productos y finalizá la compra en 3 pasos simples.</p>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <FreeShippingBar subtotal={subtotal} />

          <div className="card-surface divide-y divide-ink-50">
            {items.map((item) => (
              <div key={item.slug} className="flex gap-4 p-4">
                <Link href={`/producto/${item.slug}`} className="shrink-0">
                  <ProductImg
                    src={item.image}
                    srcSet={item.imageSrcSet ?? []}
                    alt={item.name}
                    sizes="96px"
                    width={96}
                    height={96}
                    className="h-24 w-24 rounded-xl object-cover"
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{item.brand}</p>
                  <Link
                    href={`/producto/${item.slug}`}
                    className="line-clamp-2 text-sm font-bold text-ink-900 hover:text-brand-700"
                  >
                    {item.name}
                  </Link>
                  {item.compareAtPrice ? (
                    <p className="mt-1 text-xs text-ink-400">
                      <span className="line-through">{money(item.compareAtPrice)}</span>{" "}
                      <span className="font-semibold text-emerald-600">
                        ahorrás {money((item.compareAtPrice - item.price) * item.quantity)}
                      </span>
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <QuantityStepper value={item.quantity} max={item.stock} onChange={(q) => setQuantity(item.slug, q)} />
                    <button
                      type="button"
                      onClick={() => {
                        toggleFavorite(item.slug);
                        removeItem(item.slug);
                      }}
                      className="text-xs font-semibold text-ink-400 transition hover:text-brand-700"
                    >
                      Guardar para después
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(item.slug)}
                      className="text-xs font-semibold text-ink-400 transition hover:text-rose-600"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-extrabold text-ink-900">{money(item.price * item.quantity)}</p>
                  <p className="text-[11px] text-ink-400">{money(item.price)} c/u</p>
                </div>
              </div>
            ))}
          </div>

          <div className="card-surface p-5">
            <h2 className="text-sm font-extrabold text-ink-900">🎟ï¸ ¿Tenés un cupón?</h2>
            {coupon ? (
              <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-emerald-700">{coupon.code} aplicado</p>
                  <p className="text-xs text-emerald-600">{coupon.description}</p>
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
              <form onSubmit={applyCoupon} className="mt-3 flex gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="BIENVENIDO10"
                  className="h-10 flex-1 rounded-xl border border-ink-200 px-3 text-sm uppercase outline-none focus:border-brand-400"
                />
                <button
                  type="submit"
                  disabled={checking}
                  className="rounded-xl bg-brand-600 px-5 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-60"
                >
                  Aplicar
                </button>
              </form>
            )}
            {couponError ? <p className="mt-2 text-xs font-semibold text-rose-600">{couponError}</p> : null}
            <p className="mt-2 text-[11px] text-ink-400">
              Probá con <strong>BIENVENIDO10</strong> (10% OFF) o <strong>TECHO25</strong> ($25.000 OFF desde $150.000).
            </p>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card-surface sticky top-36 space-y-3 p-5">
            <h2 className="text-lg font-extrabold text-ink-900">Resumen</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between text-ink-600">
                <dt>Subtotal</dt>
                <dd className="font-semibold text-ink-900">{money(subtotal)}</dd>
              </div>
              {savings > 0 ? (
                <div className="flex justify-between text-emerald-600">
                  <dt>Ahorro por ofertas</dt>
                  <dd className="font-semibold">-{money(savings)}</dd>
                </div>
              ) : null}
              {discount > 0 ? (
                <div className="flex justify-between text-emerald-600">
                  <dt>Cupón {coupon?.code}</dt>
                  <dd className="font-semibold">-{money(discount)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between text-ink-600">
                <dt>Envío</dt>
                <dd className="font-semibold text-ink-500">Se calcula en el checkout</dd>
              </div>
            </dl>
            <div className="flex items-end justify-between border-t border-ink-100 pt-3">
              <span className="text-sm font-semibold text-ink-600">Total estimado</span>
              <span className="text-2xl font-black text-ink-900">{money(estimatedTotal)}</span>
            </div>
            <p className="rounded-xl bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-700">
              {money(transferPrice(estimatedTotal))} pagando con transferencia o USDT (15% OFF)
            </p>
            <Link
              href="/checkout"
              className="block w-full rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-3.5 text-center text-sm font-extrabold text-white shadow-lg shadow-brand-600/25 transition hover:from-brand-700 hover:to-brand-600"
            >
              Continuar con la compra →
            </Link>
            <Link
              href="/productos"
              className="block w-full rounded-xl border border-ink-200 px-4 py-2.5 text-center text-xs font-bold text-ink-700 transition hover:bg-ink-50"
            >
              Seguir comprando
            </Link>
            <ul className="space-y-1.5 border-t border-ink-100 pt-3 text-[11px] text-ink-500">
              <li>🔒 Tus datos viajan cifrados</li>
              <li>🛡ï¸ Garantía oficial en todos los productos</li>
              <li>🚚 Envíos con seguimiento a todo el país</li>
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
    </div>
  );
}
