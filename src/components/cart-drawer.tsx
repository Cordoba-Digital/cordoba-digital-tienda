"use client";

import Link from "next/link";

import { ProductImg } from "@/components/product-img";
import { useStore } from "@/components/store-provider";
import { FREE_SHIPPING_THRESHOLD, money, transferPrice } from "@/lib/format";

export function QuantityStepper({
  value,
  max,
  onChange,
  size = "md",
}: {
  value: number;
  max: number;
  onChange: (next: number) => void;
  size?: "sm" | "md";
}) {
  const btn =
    size === "sm"
      ? "h-7 w-7 text-sm"
      : "h-9 w-9 text-base";
  return (
    <div className="inline-flex items-center rounded-xl border border-ink-200 bg-white">
      <button
        type="button"
        aria-label="Restar"
        onClick={() => onChange(value - 1)}
        className={`${btn} grid place-items-center rounded-l-xl font-bold text-ink-500 transition hover:bg-ink-50 hover:text-ink-900`}
      >
        −
      </button>
      <span className={`${size === "sm" ? "w-7 text-xs" : "w-10 text-sm"} text-center font-bold text-ink-900`}>
        {value}
      </span>
      <button
        type="button"
        aria-label="Sumar"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className={`${btn} grid place-items-center rounded-r-xl font-bold text-ink-500 transition hover:bg-ink-50 hover:text-ink-900 disabled:text-ink-200`}
      >
        +
      </button>
    </div>
  );
}

export function FreeShippingBar({ subtotal }: { subtotal: number }) {
  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const progress = Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100));
  return (
    <div className="rounded-xl bg-emerald-50 p-3">
      <p className="text-xs font-semibold text-emerald-800">
        {remaining === 0 ? (
          <>ðŸŽ‰ ¡Tenés envío gratis a todo el país!</>
        ) : (
          <>
            Te faltan <strong>{money(remaining)}</strong> para el envío gratis
          </>
        )}
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-emerald-200/60">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export function CartDrawer() {
  const { cartOpen, closeCart, items, setQuantity, removeItem, subtotal, listSubtotal, count } = useStore();

  if (!cartOpen) return null;
  const savings = Math.max(0, listSubtotal - subtotal);

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-[2px]" onClick={closeCart} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[26rem] animate-pop flex-col bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-extrabold text-ink-900">Tu carrito</h2>
            <p className="text-xs text-ink-400">{count} producto{count === 1 ? "" : "s"}</p>
          </div>
          <button
            type="button"
            onClick={closeCart}
            aria-label="Cerrar carrito"
            className="grid h-9 w-9 place-items-center rounded-full text-xl text-ink-400 transition hover:bg-ink-50 hover:text-ink-900"
          >
            ×
          </button>
        </header>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
            <span className="text-5xl">ðŸ›’</span>
            <p className="text-base font-bold text-ink-800">Tu carrito está vacío</p>
            <p className="text-sm text-ink-400">Descubrí las ofertas de la semana y armá tu setup.</p>
            <Link
              href="/productos?ofertas=1"
              onClick={closeCart}
              className="mt-2 rounded-xl bg-ink-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700"
            >
              Ver ofertas
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              <FreeShippingBar subtotal={subtotal} />
              {items.map((item) => (
                <div key={item.slug} className="flex gap-3 rounded-xl border border-ink-100 p-3">
                  <Link href={`/producto/${item.slug}`} onClick={closeCart} className="shrink-0">
                    <ProductImg
                      src={item.image}
                      srcSet={item.imageSrcSet ?? []}
                      alt={item.name}
                      sizes="64px"
                      width={64}
                      height={64}
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/producto/${item.slug}`}
                      onClick={closeCart}
                      className="line-clamp-2 text-xs font-semibold text-ink-800 hover:text-brand-700"
                    >
                      {item.name}
                    </Link>
                    <p className="mt-0.5 text-[11px] text-ink-400">{item.brand}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <QuantityStepper
                        size="sm"
                        value={item.quantity}
                        max={item.stock}
                        onChange={(next) => setQuantity(item.slug, next)}
                      />
                      <span className="text-sm font-extrabold text-ink-900">{money(item.price * item.quantity)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.slug)}
                    aria-label="Quitar"
                    className="self-start text-ink-300 transition hover:text-rose-500"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            <footer className="space-y-3 border-t border-ink-100 px-5 py-4">
              {savings > 0 ? (
                <p className="flex items-center justify-between text-xs font-semibold text-emerald-600">
                  <span>Ahorro por ofertas</span>
                  <span>-{money(savings)}</span>
                </p>
              ) : null}
              <div className="flex items-end justify-between">
                <span className="text-sm text-ink-500">Subtotal</span>
                <span className="text-2xl font-extrabold text-ink-900">{money(subtotal)}</span>
              </div>
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                Pagando con transferencia o USDT: {money(transferPrice(subtotal))} (15% OFF)
              </p>
              <Link
                href="/checkout"
                onClick={closeCart}
                className="block w-full rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-3.5 text-center text-sm font-extrabold text-white shadow-lg shadow-brand-600/25 transition hover:from-brand-700 hover:to-brand-600"
              >
                Finalizar compra →
              </Link>
              <div className="flex gap-2">
                <Link
                  href="/carrito"
                  onClick={closeCart}
                  className="flex-1 rounded-xl border border-ink-200 px-4 py-2.5 text-center text-xs font-bold text-ink-700 transition hover:bg-ink-50"
                >
                  Ver carrito
                </Link>
                <button
                  type="button"
                  onClick={closeCart}
                  className="flex-1 rounded-xl border border-ink-200 px-4 py-2.5 text-center text-xs font-bold text-ink-700 transition hover:bg-ink-50"
                >
                  Seguir comprando
                </button>
              </div>
              <p className="text-center text-[11px] text-ink-400">
                ðŸ”’ Compra protegida · Garantía oficial · Factura A/B
              </p>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}

export function Toaster() {
  const { toasts } = useStore();
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-24 right-4 z-[70] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`animate-pop rounded-xl border px-4 py-3 shadow-xl ${
            toast.tone === "success"
              ? "border-emerald-200 bg-white"
              : toast.tone === "error"
                ? "border-rose-200 bg-white"
                : "border-ink-200 bg-white"
          }`}
        >
          <p className="text-sm font-bold text-ink-900">
            {toast.tone === "success" ? "✅ " : toast.tone === "error" ? "⚠ï¸ " : "ℹï¸ "}
            {toast.title}
          </p>
          {toast.description ? <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{toast.description}</p> : null}
        </div>
      ))}
    </div>
  );
}
