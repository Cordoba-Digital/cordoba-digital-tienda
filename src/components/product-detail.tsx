"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { QuantityStepper } from "@/components/cart-drawer";
import { InstallmentsDetail } from "@/components/installments-provider";
import { UsdLine } from "@/components/usd-price";
import { ProductImg } from "@/components/product-img";
import { useStoreSelector } from "@/components/store-provider";
import { Stars } from "@/components/ui";
import { trackViewItem } from "@/lib/analytics";
import { discountPercent, money } from "@/lib/format";
import { maxQuantityFor } from "@/lib/pricing";
import { offerStockCount, unitsLabel } from "@/lib/stock-label";
import { productWhatsAppMessage, setWhatsAppProduct, whatsappLink } from "@/lib/whatsapp";

export function ProductGallery({
  images,
  srcSets = [],
  name,
  badge = null,
}: {
  images: string[];
  srcSets?: string[][];
  name: string;
  badge?: string | null;
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
      {/* Galería dentro de una tarjeta: miniaturas en columna a la izquierda
          (en fila abajo en celular) y la foto principal grande sobre blanco.
          El alto topeado a la ventana: en desktop la columna es ancha y el
          cuadrado puro salía de ~800 px, obligando a scrollear para ver la
          foto entera. Con el tope el `aspect-square` cede y el `object-contain`
          sigue encajando la foto completa. */}
      <div className="card-surface flex flex-col gap-3 p-3 sm:flex-row sm:p-4">
        <div className="no-scrollbar order-2 flex gap-2 overflow-x-auto overscroll-contain sm:order-1 sm:max-h-[78vh] sm:flex-col sm:overflow-y-auto sm:overflow-x-visible">
          {list.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              onMouseEnter={() => setActive(index)}
              onClick={() => setActive(index)}
              aria-label={`Ver foto ${index + 1} de ${list.length}`}
              aria-current={index === active}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-white transition sm:h-[4.5rem] sm:w-[4.5rem] ${
                index === active ? "border-2 border-brand-500" : "border-ink-100 hover:border-ink-300"
              }`}
            >
              <ProductImg
                src={image}
                srcSet={srcSetOf(index)}
                alt=""
                sizes="72px"
                width={96}
                height={96}
                className="h-full w-full object-contain p-1"
              />
            </button>
          ))}
        </div>

        <div
          className="relative order-1 mx-auto aspect-square max-h-[78vh] w-full max-w-[36rem] flex-1 cursor-zoom-in overflow-hidden rounded-xl bg-white sm:order-2"
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
          {badge ? (
            <span className="absolute left-3 top-3 z-10 rounded-lg bg-rose-600 px-2.5 py-1.5 text-[13px] font-extrabold leading-none text-white">
              {badge}
            </span>
          ) : null}
          <ProductImg
            src={list[active]}
            srcSet={srcSetOf(active)}
            alt={active === 0 ? name : `${name} - foto ${active + 1}`}
            sizes="(max-width: 640px) calc(100vw - 56px), 544px"
            width={800}
            height={800}
            priority
            className="pointer-events-none h-full w-full object-contain p-4 transition-transform duration-300"
            style={{ transform: zoom && !lightbox ? "scale(1.8)" : "scale(1)", transformOrigin: origin }}
          />
        </div>
      </div>

      {lightbox ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/92 p-4 overscroll-contain"
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
            className="max-h-[88vh] max-w-5xl touch-none overscroll-contain"
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
  /** Stock real aunque sea 1: el producto tiene una oferta programada. */
  stockCounted?: boolean;
  freeShipping: boolean;
  warrantyMonths: number;
  sku: string;
  rating?: number;
  reviewCount?: number;
  soldCount?: number;
};

export function BuyBox({ product }: { product: BuyBoxProduct }) {
  const router = useRouter();
  const addItem = useStoreSelector((s) => s.addItem);
  const toggleFavorite = useStoreSelector((s) => s.toggleFavorite);
  const pushRecent = useStoreSelector((s) => s.pushRecent);
  const hydrated = useStoreSelector((s) => s.hydrated);
  const fav = useStoreSelector((s) => s.hydrated && s.favorites.includes(product.slug));
  const [quantity, setQuantity] = useState(1);
  const off = discountPercent(product.price, product.compareAtPrice);
  const offerUnits = offerStockCount(product);

  // Después de leer el navegador: antes, la lectura (vacía) pisaba este
  // producto y "vistos recientemente" nunca guardaba nada.
  useEffect(() => {
    if (hydrated) pushRecent(product.slug);
  }, [hydrated, product.slug, pushRecent]);

  useEffect(() => {
    trackViewItem({
      item_id: product.slug,
      item_name: product.name,
      item_brand: product.brand,
      price: product.price,
      quantity: 1,
    });
  }, [product.slug, product.name, product.brand, product.price]);

  // El botón flotante de WhatsApp usa el mismo mensaje que "Consultar".
  useEffect(() => {
    setWhatsAppProduct(product.name);
    return () => setWhatsAppProduct(null);
  }, [product.name]);

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
    <div className="card-surface space-y-4 p-5 lg:sticky lg:top-36">
      <div>
        {product.brand && product.brand !== "General" ? (
          <p className="flex items-center gap-2 text-[13px] font-bold text-ink-500">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-brand-500 text-[11px] font-extrabold text-white" aria-hidden>
              {product.brand.charAt(0).toUpperCase()}
            </span>
            {product.brand}
          </p>
        ) : null}
        <h1 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight text-ink-900">{product.name}</h1>
        {(product.reviewCount ?? 0) > 0 || (product.soldCount ?? 0) > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-ink-500">
            {(product.reviewCount ?? 0) > 0 ? (
              <span className="flex items-center gap-1.5">
                <Stars rating={product.rating ?? 0} />
                <span className="font-semibold text-ink-700">{((product.rating ?? 0) / 10).toFixed(1)}</span>
                <a href="#opiniones" className="underline-offset-2 hover:underline">
                  ({product.reviewCount} opiniones)
                </a>
              </span>
            ) : null}
            {(product.soldCount ?? 0) > 0 ? <span>+{product.soldCount} vendidos</span> : null}
          </div>
        ) : null}
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500">
          {product.sku ? <>SKU {product.sku} · </> : null}
          Vendido por <span className="font-bold text-brand-700">Córdoba Digital</span>
        </p>
      </div>

      <div>
        {product.compareAtPrice ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] text-ink-500 line-through">{money(product.compareAtPrice)}</span>
            <span className="rounded-md bg-rose-600 px-2 py-1 text-xs font-extrabold leading-none text-white">{off}% OFF</span>
          </div>
        ) : null}
        <p className="mt-0.5 text-[2.25rem] font-extrabold leading-tight tracking-tight text-ink-900">{money(product.price)}</p>
        <UsdLine price={product.price} className="text-[15px] font-bold text-ink-500" />
        {product.stock > 0 ? (
          /* Antes decía "¡Últimas N unidades!" cuando había 5 o menos. Se sacó
             porque el campo no sirve para eso: 2.369 de 2.589 productos tienen
             stock = 1 y ninguno tiene entre 2 y 5, así que el aviso salía en el
             91% de las fichas. El `stock` del sitio original funciona como
             disponible/no disponible, no como un conteo real de depósito. En
             las ofertas con la cantidad real cargada se muestra el número
             (ver `stock-label.ts`). */
          <p className="mt-1.5 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[13px] font-bold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-current" aria-hidden />
            {offerUnits ? `${unitsLabel(offerUnits)} para envío inmediato` : "Stock disponible para envío inmediato"}
          </p>
        ) : (
          <p className="mt-1.5 text-sm font-semibold text-rose-600">Sin stock — consultanos por reposición</p>
        )}
      </div>

      {/* Cuotas: solo las que devuelve la cuenta de Mercado Pago (ver
          `lib/installments.ts`). Sin Mercado Pago configurado no aparece nada:
          no se inventan cuotas ni promos bancarias. */}
      {product.stock > 0 ? <InstallmentsDetail price={product.price} /> : null}

      {/* Los medios de pago que el sitio realmente ofrece, en una sola fila
          para que la caja entre hasta Guardar/Consultar sin scroll en una
          notebook al 100%. */}
      <div className="flex items-start gap-2.5 rounded-xl border border-ink-100 px-3.5 py-2.5 text-[13px]">
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 text-brand-700" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 10l9-6 9 6M5 10v8M19 10v8M9 10v8M15 10v8M3 20h18" />
        </svg>
        <p className="leading-snug text-ink-500">
          <b className="text-ink-900">Transferencia, efectivo o seña en el local.</b> El CBU te lo mostramos al confirmar.
        </p>
      </div>

      <div className="flex items-center justify-between text-sm font-semibold text-ink-700">
        <span>Cantidad</span>
        {/* Tope general, o el `stock` cuando la cantidad es real y menor. Con
            `stock` 1 la cantidad es desconocida (solo "hay stock"), salvo en
            productos con oferta programada (ver `maxQuantityFor`). */}
        <QuantityStepper
          value={quantity}
          max={maxQuantityFor(product.stock, product.stockCounted)}
          onChange={setQuantity}
        />
      </div>

      <div className="space-y-2">
        <button
          type="button"
          disabled={product.stock === 0}
          onClick={() => {
            addItem(payload, quantity, { silent: true, open: false });
            router.push("/carrito");
          }}
          className="h-12 w-full rounded-xl bg-cta text-[15px] font-extrabold text-white transition hover:bg-brand-700 disabled:opacity-40"
        >
          Comprar ahora
        </button>
        <button
          type="button"
          disabled={product.stock === 0}
          onClick={() => addItem(payload, quantity)}
          className="h-12 w-full rounded-xl border-2 border-brand-700 text-[15px] font-extrabold text-brand-700 transition hover:bg-brand-50 disabled:opacity-40"
        >
          Agregar al carrito
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => toggleFavorite(product.slug)}
            className={`h-11 rounded-xl border text-sm font-bold transition ${
              fav ? "border-rose-200 bg-rose-50 text-rose-600" : "border-ink-200 text-ink-700 hover:border-ink-400"
            }`}
          >
            {fav ? "♥ En favoritos" : "♡ Guardar"}
          </button>
          <a
            href={whatsappLink(productWhatsAppMessage(product.name))}
            target="_blank"
            rel="noreferrer"
            className="grid h-11 place-items-center rounded-xl border border-ink-200 text-sm font-bold text-ink-700 transition hover:border-ink-400"
          >
            Consultar
          </a>
        </div>
      </div>

      <div className="space-y-4 border-t border-ink-100 pt-4">
        {/* El costo del envío se calcula solo en el checkout, con el carrito y el código postal. */}
        <div className="flex items-start gap-3 text-[13px] leading-snug text-ink-500">
          <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z" />
          </svg>
          <p>
            <b className="block text-sm text-ink-900">Envíos a todo el país por Andreani</b>
            A domicilio o a sucursal. El costo lo ves en el checkout con tu código postal.{" "}
            <Link href="/politica-de-envios" className="font-semibold text-brand-700 underline">
              Plazos y costos
            </Link>
          </p>
        </div>
        <div className="flex items-start gap-3 text-[13px] leading-snug text-ink-500">
          <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 21s-7-6-7-11a7 7 0 0114 0c0 5-7 11-7 11zM12 10m-2.5 0a2.5 2.5 0 105 0 2.5 2.5 0 10-5 0" />
            </svg>
          <p>
            <b className="block text-sm text-ink-900">Retiro en el local</b>
            27 de Abril 180, Córdoba Capital. Lo probamos con vos.
          </p>
        </div>
        <div className="flex items-start gap-3 text-[13px] leading-snug text-ink-500">
          <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z" />
            </svg>
          <p>
            <b className="block text-sm text-ink-900">{product.warrantyMonths} meses de garantía legal</b>
            Servicio técnico propio en Córdoba y factura o comprobante de compra.
          </p>
        </div>
      </div>
    </div>
  );
}

export function MobileBuyBar({ product }: { product: BuyBoxProduct }) {
  const router = useRouter();
  const addItem = useStoreSelector((s) => s.addItem);

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
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-100 bg-surface/95 px-4 py-3 shadow-[0_-8px_24px_-16px_rgba(10,18,38,0.5)] backdrop-blur lg:hidden">
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
            className="grid h-11 w-11 place-items-center rounded-xl border border-ink-200 text-ink-800 disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="9" cy="20" r="1.5" />
              <circle cx="17" cy="20" r="1.5" />
              <path d="M2.5 3.5h2l2.6 12.5a1 1 0 001 .8h8.7a1 1 0 001-.8L20.5 7H6" />
            </svg>
          </button>
          <button
            type="button"
            disabled={product.stock === 0}
            onClick={() => {
              addItem(payload, 1, { silent: true, open: false });
              router.push("/carrito");
            }}
            className="whitespace-nowrap rounded-xl bg-cta px-5 py-3 text-sm font-extrabold text-white transition hover:bg-brand-700 disabled:opacity-40"
          >
            Comprar ahora
          </button>
        </div>
      </div>
    </div>
  );
}

export function ReviewForm({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [author, setAuthor] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [orderCode, setOrderCode] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");
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
        if (!orderCode.trim() || !email.trim()) {
          setError("Ingresá el número de pedido y el email con el que compraste.");
          setState("error");
          return;
        }
        if (author.trim().length < 2 || body.trim().length < 10) {
          setError("Completá tu nombre y una opinión de al menos 10 caracteres.");
          setState("error");
          return;
        }
        setState("loading");
        const res = await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, author, rating, title, body, orderCode, email }),
        });
        if (res.ok) {
          setState("done");
          router.refresh();
        } else {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setError(data.error ?? "No pudimos publicar tu opinión. Probá de nuevo.");
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
      <p className="text-xs text-ink-500">
        Solo pueden opinar quienes compraron este producto. Usá el número de pedido (CD-XXXXXX) y el email de la
        compra.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={orderCode}
          onChange={(e) => setOrderCode(e.target.value)}
          placeholder="Número de pedido"
          autoComplete="off"
          className="h-10 rounded-xl border border-ink-200 px-3 text-sm uppercase outline-none focus:border-brand-400"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email de la compra"
          autoComplete="email"
          className="h-10 rounded-xl border border-ink-200 px-3 text-sm outline-none focus:border-brand-400"
        />
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
        <p className="text-xs font-semibold text-rose-600">{error}</p>
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
  distribution = {},
}: {
  rating: number;
  count: number;
  /** Cantidad de reseñas verificadas por puntaje (1 a 5). */
  distribution?: Record<number, number>;
}) {
  const value = rating / 10;

  if (count === 0) {
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

  const rows = [5, 4, 3, 2, 1].map((star) => ({
    star,
    percent: Math.round(((distribution[star] ?? 0) / count) * 100),
  }));

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="text-center sm:w-40">
        <p className="text-4xl font-black text-ink-900">{value.toFixed(1)}</p>
        <div className="mt-1 flex justify-center">
          <Stars rating={rating} />
        </div>
        <p className="mt-1 text-xs text-ink-500">
          {count} {count === 1 ? "opinión verificada" : "opiniones verificadas"}
        </p>
      </div>
      <div className="flex-1 space-y-1.5">
        {rows.map((row) => (
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
