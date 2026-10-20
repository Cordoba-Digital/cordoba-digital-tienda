"use client";

import Link from "next/link";

import { ProductImg } from "@/components/product-img";
import { useStoreSelector } from "@/components/store-provider";
import { money } from "@/lib/format";
import { MAX_QTY_PER_ITEM } from "@/lib/pricing";

export function QuantityStepper({
  value,
  max,
  onChange,
  size = "md",
}: {
  value: number;
  // Tope opcional: con `max` el `+` se deshabilita al llegar. Todos los
  // llamados pasan tope (10, o el `stock` real si es menor), porque el
  // `stock` migrado 1 = hay stock no es una cantidad conocida.
  max?: number;
  onChange: (next: number) => void;
  size?: "sm" | "md";
}) {
  const btn =
    size === "sm"
      ? "h-7 w-7 text-sm"
      : "h-9 w-9 text-base";
  return (
    <div className="inline-flex items-center rounded-xl border border-ink-200 bg-surface">
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
        disabled={max !== undefined && value >= max}
        onClick={() => onChange(value + 1)}
        className={`${btn} grid place-items-center rounded-r-xl font-bold text-ink-500 transition hover:bg-ink-50 hover:text-ink-900 disabled:text-ink-200`}
      >
        +
      </button>
    </div>
  );
}

export function CartDrawer() {
  // Sin los avisos: que aparezca o se vaya uno no redibuja el panel.
  const cartOpen = useStoreSelector((s) => s.cartOpen);
  const closeCart = useStoreSelector((s) => s.closeCart);
  const items = useStoreSelector((s) => s.items);
  const setQuantity = useStoreSelector((s) => s.setQuantity);
  const removeItem = useStoreSelector((s) => s.removeItem);
  const subtotal = useStoreSelector((s) => s.subtotal);
  const listSubtotal = useStoreSelector((s) => s.listSubtotal);
  const count = useStoreSelector((s) => s.count);
  const lastAdded = useStoreSelector((s) => s.lastAdded);
  const savings = Math.max(0, listSubtotal - subtotal);

  // El panel queda siempre montado para poder animar la entrada y la salida.
  // Cerrado: `invisible` (con la transición de `visibility` se oculta recién
  // cuando termina el deslizamiento) e `inert` para que no reciba foco.
  // Con movimiento reducido solo hay fundido, sin desplazamiento.
  return (
    <div
      inert={!cartOpen}
      aria-hidden={!cartOpen}
      className={`fixed inset-0 z-[60] transition-[visibility] duration-300 ${cartOpen ? "visible" : "invisible"}`}
    >
      <div
        className={`absolute inset-0 bg-deep/50 backdrop-blur-[2px] transition-opacity duration-300 ease-out ${
          cartOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={closeCart}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Tu carrito"
        className={`absolute right-0 top-0 flex h-full w-full max-w-[26rem] flex-col bg-surface shadow-2xl transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:translate-x-0 motion-reduce:transition-opacity ${
          cartOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
        }`}
      >
        <header className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-extrabold text-ink-900">Tu carrito</h2>
            <p className="text-xs text-ink-500">{count} producto{count === 1 ? "" : "s"}</p>
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
            <span className="text-5xl">🛒</span>
            <p className="text-base font-bold text-ink-800">Tu carrito está vacío</p>
            <p className="text-sm text-ink-400">Descubrí las ofertas de la semana y armá tu setup.</p>
            <Link
              href="/productos?ofertas=1"
              onClick={closeCart}
              className="mt-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-800"
            >
              Ver ofertas
            </Link>
          </div>
        ) : (
          <>
            <div data-lenis-prevent className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4">
              {items.map((item) => (
                <div key={item.slug} className="relative flex gap-3 rounded-xl border border-ink-100 p-3">
                  {lastAdded?.slug === item.slug ? (
                    <span
                      key={lastAdded.at}
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 animate-flash rounded-xl motion-reduce:animate-none"
                    />
                  ) : null}
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
                    <p className="mt-0.5 text-[11px] text-ink-500">{item.brand}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <QuantityStepper
                        size="sm"
                        value={item.quantity}
                        max={item.stock > 1 ? Math.min(item.stock, MAX_QTY_PER_ITEM) : MAX_QTY_PER_ITEM}
                        onChange={(next) => setQuantity(item.slug, next)}
                      />
                      <span className="text-sm font-extrabold text-ink-900">{money(item.price * item.quantity)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.slug)}
                    aria-label="Quitar"
                    className="self-start text-ink-500 transition hover:text-rose-500"
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
                <p className="flex items-center justify-between text-xs font-semibold text-emerald-700">
                  <span>Ahorro por ofertas</span>
                  <span>-{money(savings)}</span>
                </p>
              ) : null}
              <div className="flex items-end justify-between">
                <span className="text-sm text-ink-500">Subtotal</span>
                <span className="text-2xl font-extrabold text-ink-900">{money(subtotal)}</span>
              </div>
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
              <p className="text-center text-[11px] text-ink-500">
                Compra protegida · 6 meses de garantía legal
              </p>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}

export function Toaster() {
  const toasts = useStoreSelector((s) => s.toasts);
  const cartOpen = useStoreSelector((s) => s.cartOpen);
  // Con el carrito abierto los avisos quedarían encima del pie del panel
  // (en mobile ocupa todo el ancho), así que se ocultan hasta cerrarlo.
  if (!toasts.length || cartOpen) return null;
  return (
    <div className="pointer-events-none fixed bottom-24 right-4 z-[70] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`animate-pop rounded-xl border px-4 py-3 shadow-xl ${
            toast.tone === "success"
              ? "border-emerald-200 bg-surface"
              : toast.tone === "error"
                ? "border-rose-200 bg-surface"
                : "border-ink-200 bg-surface"
          }`}
        >
          <p className="text-sm font-bold text-ink-900">
            {toast.tone === "success" ? "✅ " : toast.tone === "error" ? "⚠️ " : "ℹ️ "}
            {toast.title}
          </p>
          {toast.description ? <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{toast.description}</p> : null}
        </div>
      ))}
    </div>
  );
}
