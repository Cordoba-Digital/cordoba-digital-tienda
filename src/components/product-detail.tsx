"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { QuantityStepper } from "@/components/cart-drawer";
import { ProductImg } from "@/components/product-img";
import { useStore } from "@/components/store-provider";
import { Spinner, Stars } from "@/components/ui";
import { discountPercent, money } from "@/lib/format";
import { MAX_QTY_PER_ITEM } from "@/lib/pricing";
import type { ShippingOption } from "@/lib/shipping";

export function ProductGallery({
  images,
  srcSets = [],
  name,
}: {
  images: string[];
  srcSets?: string[][];
  name: string;
}) {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  const [lightbox, setLightbox] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const list = images.length ? images : [""];
  const srcSetOf = (index: number): string[] => srcSets[index] ?? [];

  // `go` se memoriza para poder ponerlo en las dependencias del efecto de
  // teclado: si no, eslint avisa de que el efecto closurea una función que
  // cambia en cada render.
  const go = useCallback(
    (delta: number) => {
      setActive((current) => (current + delta + list.length) % list.length);
    },
    [list.length],
  );

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox(false);
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [lightbox, go]);

  return (
    <>
      {/* Galería sin caja, como la referencia: la foto respira sobre el fondo
          y las miniaturas van en fila abajo en todos los viewports. */}
      <div className="flex flex-col items-center gap-3">
        <div className="no-scrollbar order-2 flex gap-2 self-stretch overflow-x-auto sm:justify-center">
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

        <div
          className="relative order-1 aspect-square w-full max-w-[30rem] cursor-zoom-in overflow-hidden"
          onMouseEnter={() => setZoom(true)}
          onMouseLeave={() => setZoom(false)}
          onMouseMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * 100;
            const y = ((event.clientY - rect.top) / rect.height) * 100;
            setOrigin(`${x}% ${y}%`);
          }}
          onClick={() => setLightbox(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setLightbox(true);
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={`Ampliar foto de ${name}`}
        >
          {/* Acá había un pill con el `badge` ("Oferta") arriba de la foto y un
              "Ver grande" abajo a la derecha. Se sacaron los dos a pedido: el
              badge salía en el 91% de las fichas y no distinguía nada. El clic
              para ampliar sigue funcionando igual. */}
          <ProductImg
            src={list[active]}
            srcSet={srcSetOf(active)}
            alt={name}
            sizes="(max-width: 1024px) 100vw, 700px"
            width={800}
            height={800}
            priority
            className="pointer-events-none h-full w-full object-contain p-2 transition-transform duration-300"
            style={{ transform: zoom && !lightbox ? "scale(1.8)" : "scale(1)", transformOrigin: origin }}
          />
        </div>
      </div>

      {lightbox ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/92 p-4"
          onClick={() => setLightbox(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`Galería de ${name}`}
        >
          <button
            type="button"
            onClick={() => setLightbox(false)}
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-lg text-white hover:bg-white/20"
            aria-label="Cerrar"
          >
            ×
          </button>
          {list.length > 1 ? (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  go(-1);
                }}
                className="absolute left-3 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20 sm:left-6"
                aria-label="Foto anterior"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  go(1);
                }}
                className="absolute right-3 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20 sm:right-6"
                aria-label="Foto siguiente"
              >
                ›
              </button>
            </>
          ) : null}
          <div
            className="max-h-[88vh] max-w-5xl"
            onClick={(event) => event.stopPropagation()}
            onTouchStart={(event) => {
              touchStartX.current = event.touches[0]?.clientX ?? null;
            }}
            onTouchEnd={(event) => {
              if (touchStartX.current == null) return;
              const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
              const dx = endX - touchStartX.current;
              touchStartX.current = null;
              if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
            }}
          >
            <ProductImg
              src={list[active]}
              srcSet={srcSetOf(active)}
              alt={name}
              sizes="90vw"
              width={1200}
              height={1200}
              priority
              className="max-h-[88vh] w-auto object-contain"
            />
            <p className="mt-3 text-center text-xs text-white/70">
              {active + 1} / {list.length} · Esc o click afuera para cerrar
            </p>
          </div>
        </div>
      ) : null}
    </>
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
  rating?: number;
  reviewCount?: number;
  soldCount?: number;
};

export function BuyBox({ product }: { product: BuyBoxProduct }) {
  const router = useRouter();
  const { addItem, toggleFavorite, isFavorite, hydrated, pushRecent } = useStore();
  const [quantity, setQuantity] = useState(1);
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
      {/* Título integrado a la tarjeta, como en la referencia: marca, nombre
          y precio en la misma ventana de la derecha, no sueltos al lado de
          la galería. */}
      <div>
        {product.brand && product.brand !== "General" ? (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">{product.brand}</p>
        ) : null}
        <h1 className="mt-0.5 text-xl font-extrabold leading-tight tracking-tight text-ink-900">
          {product.name}
        </h1>
        {(product.reviewCount ?? 0) > 0 || (product.soldCount ?? 0) > 0 || product.sku ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-ink-500">
            {(product.reviewCount ?? 0) > 0 ? (
              <span className="flex items-center gap-1.5">
                <Stars rating={product.rating ?? 0} />
                <span className="font-semibold text-ink-700">{((product.rating ?? 0) / 10).toFixed(1)}</span>
                <a href="#opiniones" className="underline-offset-2 hover:underline">
                  ({product.reviewCount} opiniones)
                </a>
              </span>
            ) : null}
            {(product.soldCount ?? 0) > 0 ? <span>· +{product.soldCount} vendidos</span> : null}
            {product.sku ? <span>· SKU {product.sku}</span> : null}
          </div>
        ) : null}
      </div>

      {/* "Vendido por" con dato real (somos el vendedor), como la referencia.
          Sin cuotas ni promos bancarias: no hay datos y no se inventan. */}
      <p className="-mt-2 text-xs text-ink-500">
        Vendido por <span className="font-semibold text-brand-700">Córdoba Digital</span>
      </p>

      <div>
        {product.compareAtPrice ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-ink-500 line-through">{money(product.compareAtPrice)}</span>
            <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white">-{off}%</span>
          </div>
        ) : null}
        <p className="text-3xl font-black tracking-tight text-ink-900">{money(product.price)}</p>
      </div>

      {/* El simulador de cuotas se sacó: los planes no existen en el sitio
          original. Ver la nota de installmentValue en lib/format.ts. */}

      <div className="flex items-center justify-between text-sm">
        <span className="text-ink-500">Cantidad</span>
        {/* Tope: 10 unidades, o el `stock` cuando la cantidad es real
            (> 1) y menor. Con `stock` 1 la cantidad es desconocida (solo
            "hay stock"), así que rige el tope general. */}
        <QuantityStepper
          value={quantity}
          max={product.stock > 1 ? Math.min(product.stock, MAX_QTY_PER_ITEM) : MAX_QTY_PER_ITEM}
          onChange={setQuantity}
        />
      </div>

      {product.stock > 0 ? (
        /* Antes decía "¡Últimas N unidades!" cuando había 5 o menos. Se sacó
           porque el campo no sirve para eso: en el catálogo migrado 2.369 de
           2.589 productos tienen stock = 1 y ninguno tiene entre 2 y 5, así que
           el aviso salía en el 91% de las fichas y no informaba nada. Peor,
           un "¡Última unidad!" repetido en cada producto es urgencia inventada.
           El `stock` del sitio original funciona como disponible/no disponible,
           no como un conteo real de depósito. Cuando el cliente mande el
           inventario de verdad, acá vuelve el aviso con el número real. */
        <p className="text-xs font-semibold text-emerald-700">
          ✅ Stock disponible para envío inmediato
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
            router.push("/carrito");
          }}
          className="w-full rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-brand-600/25 transition hover:from-brand-700 hover:to-brand-600 disabled:opacity-40"
        >
          Comprar
        </button>
        <button
          type="button"
          disabled={product.stock === 0}
          onClick={() => addItem(payload, quantity)}
          className="w-full rounded-xl border border-ink-200 bg-surface px-4 py-3 text-sm font-bold text-ink-800 transition hover:border-brand-400 hover:text-brand-700 disabled:opacity-40"
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

      {/* El envío como sección con divisor dentro de la tarjeta, no como card
          aparte: una sola ventana con secciones, como la referencia. */}
      <div className="border-t border-ink-100 pt-4">
        <ShippingCalculator price={product.price} />
      </div>

      <ul className="space-y-2 border-t border-ink-100 pt-4 text-xs text-ink-600">
        <li className="flex items-center gap-2">🛡️ {product.warrantyMonths} meses de garantía legal</li>
        <li className="flex items-center gap-2">🔧 Servicio técnico propio en el local</li>
        <li className="flex items-center gap-2">🧽 Factura o comprobante de compra</li>
        <li className="flex items-center gap-2">🏬 Retiro en 27 de Abril 180, Córdoba Capital</li>
      </ul>
      {/* 63 de los 2.589 productos migrados vienen con el SKU vacío, no nulo.
          Sin esta guarda la caja de compra imprimía un "SKU " pelado. La misma
          guarda ya está en la línea de arriba del nombre, en la ficha. */}
      {product.sku ? <p className="text-[10px] text-ink-500">SKU {product.sku}</p> : null}
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
              router.push("/carrito");
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
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-bold text-white transition hover:bg-brand-800 disabled:opacity-60"
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
          className="rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-800 disabled:opacity-60"
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
  ratings = [],
}: {
  rating: number;
  count: number;
  /** Solo los puntajes: la distribución no necesita título, texto ni autor,
      así que no se serializan las reseñas enteras al cliente. */
  ratings?: number[];
}) {
  const value = rating / 10;

  if (count === 0 || ratings.length === 0) {
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

  const total = ratings.length;
  const distribution = [5, 4, 3, 2, 1].map((star) => {
    const hits = ratings.filter((r) => Math.round(r) === star).length;
    return { star, percent: Math.round((hits / total) * 100) };
  });

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="text-center sm:w-40">
        <p className="text-4xl font-black text-ink-900">{value.toFixed(1)}</p>
        <div className="mt-1 flex justify-center">
          <Stars rating={rating} />
        </div>
        <p className="mt-1 text-xs text-ink-500">{count} opiniones</p>
      </div>
      <div className="flex-1 space-y-1.5">
        {distribution.map((row) => (
          <div key={row.star} className="flex items-center gap-2 text-xs">
            <span className="w-6 text-ink-500">{row.star}★</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
              <div className="h-full rounded-full bg-amber-400" style={{ width: `${row.percent}%` }} />
            </div>
            <span className="w-8 text-right text-ink-400">{row.percent}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
