"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { QuantityStepper } from "@/components/cart-drawer";
import { ProductImg } from "@/components/product-img";
import { useStore } from "@/components/store-provider";
import { Spinner, Stars } from "@/components/ui";
import { INSTALLMENT_PLANS, discountPercent, installmentValue, money, transferPrice } from "@/lib/format";
import type { ShippingOption } from "@/lib/shipping";

export function ProductGallery({
  images,
  srcSets = [],
  name,
  badge,
}: {
  images: string[];
  /** Un srcset por entrada de `images`, en el mismo orden. */
  srcSets?: string[][];
  name: string;
  badge?: string | null;
}) {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  const list = images.length ? images : [""];
  // Cada foto usa solo sus propias variantes. Con un srcset compartido entre
  // todas, el navegador elegía una variante de otra foto y las miniaturas
  // mostraban la misma imagen.
  const srcSetOf = (index: number): string[] => srcSets[index] ?? [];

  return (
    <div className="flex flex-col-reverse items-center gap-3 sm:flex-row sm:items-start sm:justify-center">
      <div className="no-scrollbar flex gap-2 overflow-x-auto sm:flex-col">
        {list.map((image, index) => (
          <button
            key={`${image}-${index}`}
            type="button"
            onMouseEnter={() => setActive(index)}
            onClick={() => setActive(index)}
            aria-label={`Ver foto ${index + 1} de ${list.length}`}
            aria-current={index === active}
            className={`h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 bg-surface transition sm:h-24 sm:w-24 ${
              index === active ? "border-brand-500" : "border-ink-100 hover:border-ink-300"
            }`}
          >
            <ProductImg
              src={image}
              srcSet={srcSetOf(index)}
              alt=""
              sizes="96px"
              width={128}
              height={128}
              className="h-full w-full object-contain p-1"
            />
          </button>
        ))}
      </div>

      {/* Marco acotado: las fotos de WooCommerce vienen en cualquier proporción
          (muchas verticales) y con object-cover se recortaban. Con object-contain
          se ve el producto entero, como en la ficha de Mercado Libre. */}
      <div
        className="relative aspect-square w-full max-w-[30rem] overflow-hidden rounded-2xl border border-ink-100 bg-surface"
        onMouseEnter={() => setZoom(true)}
        onMouseLeave={() => setZoom(false)}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const x = ((event.clientX - rect.left) / rect.width) * 100;
          const y = ((event.clientY - rect.top) / rect.height) * 100;
          setOrigin(`${x}% ${y}%`);
        }}
      >
        {badge ? (
          <span className="absolute left-4 top-4 z-10 rounded-full bg-deep/85 px-3 py-1.5 text-[11px] font-bold text-white">
            {badge}
          </span>
        ) : null}
        <ProductImg
          src={list[active]}
          srcSet={srcSetOf(active)}
          alt={name}
          sizes="(max-width: 1024px) 100vw, 700px"
          width={800}
          height={800}
          priority
          className="h-full w-full object-contain p-6 transition-transform duration-300"
          // El zoom es una transformación CSS sobre la imagen elegida.
          style={{ transform: zoom ? "scale(1.8)" : "scale(1)", transformOrigin: origin }}
        />
        <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-ink-500">
          🔍 Pasá el mouse para ampliar
        </span>
      </div>
    </div>
  );
}

export type BuyBoxProduct = {
  slug: string;
  name: string;
  brand: string;
  image: string;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  freeShipping: boolean;
  warrantyMonths: number;
  sku: string;
};

export function BuyBox({ product }: { product: BuyBoxProduct }) {
  const router = useRouter();
  const { addItem, toggleFavorite, isFavorite, hydrated, pushRecent } = useStore();
  const [quantity, setQuantity] = useState(1);
  const [plan, setPlan] = useState(6);
  const off = discountPercent(product.price, product.compareAtPrice);
  const fav = hydrated && isFavorite(product.slug);

  useEffect(() => {
    pushRecent(product.slug);
  }, [product.slug, pushRecent]);

  const payload = {
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    image: product.image,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    stock: product.stock,
    freeShipping: product.freeShipping,
  };

  return (
    <div className="card-surface sticky top-36 space-y-4 p-5">
      <div>
        {product.compareAtPrice ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-ink-400 line-through">{money(product.compareAtPrice)}</span>
            <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-bold text-white">-{off}%</span>
          </div>
        ) : null}
        <p className="text-3xl font-black tracking-tight text-ink-900">{money(product.price)}</p>
        <div className="mt-2 rounded-xl bg-emerald-50 px-3 py-2.5">
          <p className="text-sm font-extrabold text-emerald-700">{money(transferPrice(product.price))}</p>
          <p className="text-[11px] font-semibold text-emerald-600">Pagando con transferencia o USDT (15% OFF)</p>
        </div>
      </div>

      <div className="rounded-xl border border-ink-100 p-3">
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-ink-400">
          Simulá tus cuotas
        </label>
        <select
          value={plan}
          onChange={(e) => setPlan(Number(e.target.value))}
          className="h-9 w-full rounded-lg border border-ink-200 bg-surface px-2 text-sm font-semibold text-ink-800 outline-none focus:border-brand-400"
        >
          {INSTALLMENT_PLANS.map((option) => (
            <option key={option.count} value={option.count}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="mt-2 text-sm font-bold text-ink-900">
          {plan} x {money(installmentValue(product.price, plan))}
        </p>
        <p className="text-[11px] text-ink-400">
          {plan <= 6 ? "Sin interés con todas las tarjetas" : "Plan de cuotas fijas con interés"}
        </p>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-ink-500">Cantidad</span>
        <QuantityStepper value={quantity} max={Math.max(1, product.stock)} onChange={setQuantity} />
      </div>

      {product.stock > 0 ? (
        <p className="text-xs font-semibold text-emerald-600">
          ✅ {product.stock <= 5 ? `¡Últimas ${product.stock} unidades!` : "Stock disponible para envío inmediato"}
        </p>
      ) : (
        <p className="text-xs font-semibold text-rose-600">Sin stock — consultanos por reposición</p>
      )}

      <div className="space-y-2">
        <button
          type="button"
          disabled={product.stock === 0}
          onClick={() => {
            addItem(payload, quantity, { silent: true, open: false });
            router.push("/checkout");
          }}
          className="w-full rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-brand-600/25 transition hover:from-brand-700 hover:to-brand-600 disabled:opacity-40"
        >
          Comprar ahora
        </button>
        <button
          type="button"
          disabled={product.stock === 0}
          onClick={() => addItem(payload, quantity)}
          className="w-full rounded-xl border border-ink-200 bg-surface px-4 py-3 text-sm font-bold text-ink-800 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-40"
        >
          Agregar al carrito
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => toggleFavorite(product.slug)}
            className={`flex-1 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
              fav ? "border-rose-200 bg-rose-50 text-rose-600" : "border-ink-200 text-ink-600 hover:text-rose-500"
            }`}
          >
            {fav ? "♥ En favoritos" : "♡ Guardar"}
          </button>
          <a
            href={`https://wa.me/5493516777774?text=${encodeURIComponent(`Hola! Quiero consultar por ${product.name}`)}`}
            target="_blank"
            rel="noreferrer"
            className="flex-1 rounded-xl border border-ink-200 px-3 py-2.5 text-center text-xs font-bold text-ink-600 transition hover:border-emerald-300 hover:text-emerald-700"
          >
            Consultar
          </a>
        </div>
      </div>

      <ul className="space-y-2 border-t border-ink-100 pt-4 text-xs text-ink-600">
        <li className="flex items-center gap-2">🛡️ {product.warrantyMonths} meses de garantía oficial</li>
        <li className="flex items-center gap-2">🔄 10 días para cambios sin cargo</li>
        <li className="flex items-center gap-2">🧾 Factura A / B</li>
        <li className="flex items-center gap-2">🏬 Retiro en 2 hs en 27 de Abril 259</li>
      </ul>
      <p className="text-[10px] text-ink-300">SKU {product.sku}</p>
    </div>
  );
}

export function MobileBuyBar({ product }: { product: BuyBoxProduct }) {
  const router = useRouter();
  const { addItem } = useStore();

  const payload = {
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    image: product.image,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    stock: product.stock,
    freeShipping: product.freeShipping,
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-100 bg-surface/95 px-4 py-3 pr-[5.5rem] shadow-[0_-8px_24px_-16px_rgba(10,18,38,0.5)] backdrop-blur lg:hidden">
      <div className="flex items-center gap-3">
        <div className="min-w-0">
          <p className="text-lg font-black leading-none text-ink-900">{money(product.price)}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-emerald-600">
            {money(transferPrice(product.price))} con transferencia
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            aria-label="Agregar al carrito"
            disabled={product.stock === 0}
            onClick={() => addItem(payload, 1)}
            className="grid h-11 w-11 place-items-center rounded-xl border border-ink-200 text-lg disabled:opacity-40"
          >
            🛒
          </button>
          <button
            type="button"
            disabled={product.stock === 0}
            onClick={() => {
              addItem(payload, 1, { silent: true, open: false });
              router.push("/checkout");
            }}
            className="rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-5 py-3 text-sm font-extrabold text-white disabled:opacity-40"
          >
            Comprar
          </button>
        </div>
      </div>
    </div>
  );
}

export function ShippingCalculator({ price }: { price: number }) {
  const [zip, setZip] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ zone: string; options: ShippingOption[] } | null>(null);

  const quote = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/shipping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zip, subtotal: price }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "No pudimos calcular el envío.");
        setResult(null);
      } else {
        setResult({ zone: data.zone, options: data.options });
      }
    } catch {
      setError("No pudimos calcular el envío. Probá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card-surface p-5">
      <h3 className="text-sm font-extrabold text-ink-900">📍 Calculá el costo de envío</h3>
      <p className="mt-1 text-xs text-ink-500">Ingresá tu código postal y te mostramos las opciones disponibles.</p>
      <form onSubmit={quote} className="mt-3 flex gap-2">
        <input
          value={zip}
          onChange={(e) => setZip(e.target.value)}
          inputMode="numeric"
          maxLength={8}
          placeholder="Ej: 5000"
          className="h-10 w-32 rounded-xl border border-ink-200 px-3 text-sm outline-none focus:border-brand-400"
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? <Spinner className="h-4 w-4" /> : null}
          Calcular
        </button>
      </form>
      {error ? <p className="mt-2 text-xs font-semibold text-rose-600">{error}</p> : null}
      {result ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-semibold text-ink-500">Zona detectada: {result.zone}</p>
          {result.options.map((option) => (
            <div key={option.id} className="flex items-start justify-between gap-3 rounded-xl border border-ink-100 p-3">
              <div>
                <p className="text-xs font-bold text-ink-900">{option.label}</p>
                <p className="text-[11px] text-ink-500">{option.eta}</p>
              </div>
              <span className={`text-sm font-extrabold ${option.free ? "text-emerald-600" : "text-ink-900"}`}>
                {option.free ? "Gratis" : money(option.cost)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ReviewForm({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [author, setAuthor] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const router = useRouter();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-ink-200 bg-surface px-4 py-2.5 text-sm font-bold text-ink-700 transition hover:border-brand-300 hover:text-brand-700"
      >
        Escribir una opinión
      </button>
    );
  }

  if (state === "done") {
    return (
      <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
        ¡Gracias por tu opinión! Ya está publicada.
      </div>
    );
  }

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        if (author.trim().length < 2 || body.trim().length < 10) {
          setState("error");
          return;
        }
        setState("loading");
        const res = await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, author, rating, title, body }),
        });
        if (res.ok) {
          setState("done");
          router.refresh();
        } else {
          setState("error");
        }
      }}
      className="card-surface space-y-3 p-5"
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-ink-700">Tu puntaje:</span>
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRating(value)}
            className={`text-xl transition ${value <= rating ? "text-amber-400" : "text-ink-200"}`}
            aria-label={`${value} estrellas`}
          >
            ★
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Tu nombre"
          className="h-10 rounded-xl border border-ink-200 px-3 text-sm outline-none focus:border-brand-400"
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título (opcional)"
          className="h-10 rounded-xl border border-ink-200 px-3 text-sm outline-none focus:border-brand-400"
        />
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Contanos tu experiencia con el producto"
        className="w-full rounded-xl border border-ink-200 p-3 text-sm outline-none focus:border-brand-400"
      />
      {state === "error" ? (
        <p className="text-xs font-semibold text-rose-600">Completá tu nombre y una opinión de al menos 10 caracteres.</p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={state === "loading"}
          className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {state === "loading" ? "Publicando..." : "Publicar opinión"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl border border-ink-200 px-5 py-2.5 text-sm font-bold text-ink-600"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function RatingSummary({
  rating,
  count,
  reviews = [],
}: {
  rating: number;
  count: number;
  reviews?: { rating: number }[];
}) {
  const value = rating / 10;

  // La distribución se calcula con las opiniones reales: sin datos no se
  // inventan porcentajes.
  if (count === 0 || reviews.length === 0) {
    return (
      <p className="rounded-xl bg-ink-50 px-4 py-3 text-sm text-ink-500">
        Todavía no hay opiniones de este producto. Si lo compraste,{" "}
        <a href="#opiniones" className="font-semibold text-brand-700 underline underline-offset-2">
          dejá la tuya
        </a>
        .
      </p>
    );
  }

  const total = reviews.length;
  const distribution = [5, 4, 3, 2, 1].map((star) => {
    const hits = reviews.filter((r) => Math.round(r.rating) === star).length;
    return { star, percent: Math.round((hits / total) * 100) };
  });

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="text-center sm:w-40">
        <p className="text-4xl font-black text-ink-900">{value.toFixed(1)}</p>
        <Stars rating={rating} size="md" />
        <p className="mt-1 text-xs text-ink-400">{count} opiniones</p>
      </div>
      <div className="flex-1 space-y-1.5">
        {distribution.map((row) => (
          <div key={row.star} className="flex items-center gap-2 text-xs text-ink-500">
            <span className="w-8">{row.star}★</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
              <div className="h-full rounded-full bg-amber-400" style={{ width: `${row.percent}%` }} />
            </div>
            <span className="w-8 text-right">{row.percent}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
