"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { ProductImg } from "@/components/product-img";
import { useStore } from "@/components/store-provider";
import { Spinner } from "@/components/ui";
import { readCoupon, writeCoupon } from "@/lib/coupon-storage";
import { money } from "@/lib/format";
import { computeTotals, PAYMENT_METHODS, type CouponInfo, type PaymentMethodId } from "@/lib/pricing";
import { validateDelivery, validatePersonalData } from "@/lib/checkout-validation";
import { useShippingQuote } from "@/lib/shipping-quote";
import type { DeliveryMethod, ShippingOption } from "@/lib/shipping";

type CheckoutIconProps = { className?: string };

function IconBank({ className = "h-5 w-5 shrink-0 text-brand-700" }: CheckoutIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 10l9-6 9 6M5 10v8M19 10v8M9 10v8M15 10v8M3 20h18" />
    </svg>
  );
}

function IconCard({ className = "h-5 w-5 shrink-0 text-brand-700" }: CheckoutIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 7h18v12H3zM3 11h18" />
    </svg>
  );
}

function IconUsdt({ className = "h-5 w-5 shrink-0 text-brand-700" }: CheckoutIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9 8.5h6M12 8.5v6.5" />
    </svg>
  );
}

function IconTruck({ className = "h-5 w-5 shrink-0 text-brand-700" }: CheckoutIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z" />
    </svg>
  );
}

function IconPin({ className = "h-5 w-5 shrink-0 text-brand-700" }: CheckoutIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 21s-7-6-7-11a7 7 0 0114 0c0 5-7 11-7 11zM12 10m-2.5 0a2.5 2.5 0 105 0 2.5 2.5 0 10-5 0" />
    </svg>
  );
}

function IconShield({ className = "h-5 w-5 shrink-0 text-brand-700" }: CheckoutIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z" />
    </svg>
  );
}

function IconLock({ className = "h-5 w-5 shrink-0 text-brand-700" }: CheckoutIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 018 0v3M12 14.5v2" />
    </svg>
  );
}

function IconTicket({ className = "h-5 w-5 shrink-0 text-brand-700" }: CheckoutIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 8h16v3a1.5 1.5 0 000 3v3H4v-3a1.5 1.5 0 000-3zM13.5 8.5v1.5M13.5 11.2v1.6M13.5 14v1.5" />
    </svg>
  );
}

function IconTag({ className = "h-5 w-5 shrink-0 text-brand-700" }: CheckoutIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 4h7l9 9-7 7-9-9z" />
      <circle cx="9" cy="9" r="1.4" />
    </svg>
  );
}

function IconReceipt({ className = "h-5 w-5 shrink-0 text-brand-700" }: CheckoutIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 3.5h12V21l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4zM9 8h6M9 12h6" />
    </svg>
  );
}

function IconStore({ className = "h-5 w-5 shrink-0 text-brand-700" }: CheckoutIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 9.5l1.6-4.5h12.8L20 9.5M4 9.5V19h16V9.5M4 9.5h16M9.5 19v-4.5h5V19" />
    </svg>
  );
}

function IconCash({ className = "h-5 w-5 shrink-0 text-brand-700" }: CheckoutIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="6.5" width="18" height="11" rx="2" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6 9.5h.01M18 14.5h.01" />
    </svg>
  );
}

const PAYMENT_ICONS = {
  transferencia: IconBank,
  usdt: IconUsdt,
  efectivo: IconCash,
  mercadopago: IconCard,
} as const;

const PROVINCES = [
  "Buenos Aires",
  "CABA",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tucumán",
];

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  docId: string;
  zip: string;
  street: string;
  number: string;
  extra: string;
  city: string;
  province: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  docId: "",
  zip: "",
  street: "",
  number: "",
  extra: "",
  city: "",
  province: "Córdoba",
  notes: "",
};

function Field({
  label,
  error,
  children,
  hint,
  className = "",
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`} data-error={error ? "true" : undefined}>
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-500">{label}</span>
      {children}
      {error ? <span role="alert" className="mt-1 block text-xs font-semibold text-rose-600">{error}</span> : null}
      {!error && hint ? <span className="mt-1 block text-[11px] text-ink-500">{hint}</span> : null}
    </label>
  );
}

const inputClass =
  "h-11 w-full rounded-xl border border-ink-200 bg-surface px-3.5 text-sm text-ink-900 outline-none transition placeholder:text-ink-500 focus:border-brand-400 focus:ring-4 focus:ring-brand-100";

export function CheckoutFlow() {
  const router = useRouter();
  const { items, subtotal, listSubtotal, hydrated, clearCart, setQuantity } = useStore();

  // Sin wizard: el checkout es una sola página, igual que el del sitio original.
  // Antes eran 3 pasos y el medio de pago quedaba escondido en el último, así
  // que el comprador Tomaba la decisión de cómo pagar sin verla.
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("standard");
  const [payment, setPayment] = useState<PaymentMethodId>("transferencia");
  const [installments, setInstallments] = useState(6);
  const [coupon, setCoupon] = useState<CouponInfo | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [terms, setTerms] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setCoupon(readCoupon());
      try {
        const saved = window.localStorage.getItem("cd_checkout_v1");
        if (saved) setForm({ ...EMPTY_FORM, ...(JSON.parse(saved) as Partial<FormState>) });
      } catch {
        /* ignore */
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  // Persistencia con debounce: sin esto cada tecla escribe a localStorage
  // (lectura/escritura sincrónica que bloquea el hilo en cada keystroke).
  const persistTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!hydrated) return;
    window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      window.localStorage.setItem("cd_checkout_v1", JSON.stringify({ ...form, notes: "" }));
    }, 400);
    return () => window.clearTimeout(persistTimer.current);
  }, [form, hydrated]);

  // Quote shipping whenever the ZIP or subtotal changes.
  const { options, zone, loading: zipLoading } = useShippingQuote({ zip: form.zip, subtotal });

  const selectedOption = useMemo(() => {
    if (deliveryMethod === "pickup") {
      return {
        id: "pickup" as DeliveryMethod,
        label: "Retiro en el local",
        description: "27 de Abril 180, Córdoba Capital",
        eta: "Listo en el horario de atención",
        cost: 0,
        free: true,
      } satisfies ShippingOption;
    }
    return options.find((option) => option.id === deliveryMethod) ?? null;
  }, [deliveryMethod, options]);

  const totals = computeTotals({
    subtotal,
    listSubtotal,
    coupon,
    shippingCost: selectedOption?.cost ?? 0,
    paymentMethod: payment,
    installments,
  });

  // Efectivo solo vale con retiro: se corrige en el mismo handler que
  // cambia la entrega, no en un efecto posterior (evita un render con el
  // estado inconsistente y el ida y vuelta del efecto).
  const chooseDelivery = (method: DeliveryMethod) => {
    setDeliveryMethod(method);
    if (method !== "pickup") {
      setPayment((prev) => (prev === "efectivo" ? "transferencia" : prev));
    }
  };

  const set = (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // Los dos validadores DEVUELVEN los errores en vez de fijarlos: si cada uno
  // hiciera `setErrors`, el segundo pisaría los del primero y el comprador vería
  // un solo bloque marcado.
  const datosErrors = (): Record<string, string> => validatePersonalData(form);

  const entregaErrors = (): Record<string, string> =>
    validateDelivery({
      method: deliveryMethod,
      zip: form.zip,
      street: form.street,
      number: form.number,
      city: form.city,
      province: form.province,
      selectedOption,
      requireShippingOption: true,
    });

  const applyCoupon = async (event: React.FormEvent) => {
    event.preventDefault();
    setCouponError(null);
    const res = await fetch("/api/coupon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: couponCode, subtotal }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setCouponError(data.error ?? "Cupón inválido");
      return;
    }
    setCoupon(data.coupon);
    writeCoupon(data.coupon);
    setCouponCode("");
  };

  // Sin wizard no hay a qué paso volver, así que se validan datos y entrega juntos
  // y se llevan al primer campo que falta. El `data-error` lo pone cada `Field`
  // con error; el label no es focusable, así que se le pasa el foco al control
  // que tiene adentro.
  const irAlPrimerError = (selector = "[data-error='true']") => {
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const foco = el.matches("input, select, textarea")
      ? el
      : el.querySelector<HTMLElement>("input, select, textarea");
    foco?.focus();
  };

  const submit = async () => {
    const found = { ...datosErrors(), ...entregaErrors() };
    if (Object.keys(found).length) {
      setErrors(found);
      irAlPrimerError();
      return;
    }
    if (!terms) {
      setErrors({ terms: "Tenés que aceptar los términos para continuar." });
      irAlPrimerError("[data-error='terms']");
      return;
    }
    setSubmitting(true);
    setServerError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({ slug: item.slug, quantity: item.quantity })),
          customer: {
            firstName: form.firstName,
            lastName: form.lastName,
            email: form.email,
            phone: form.phone,
            docId: form.docId,
          },
          delivery: {
            method: deliveryMethod,
            zip: form.zip,
            street: form.street,
            number: form.number,
            extra: form.extra,
            city: form.city,
            province: form.province,
          },
          payment: { method: payment, installments },
          couponCode: coupon?.code ?? null,
          notes: form.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (data.errors) {
          setErrors(data.errors as Record<string, string>);
          window.setTimeout(() => irAlPrimerError(), 0);
        }
        setServerError(data.error ?? "Revisá los datos marcados en rojo.");
        return;
      }
      clearCart();
      writeCoupon(null);
      // La rama de Mercado Pago queda fuera de este loader: solo se habilita
      // cuando el negocio active la opción en el checkout.
      router.push(`/pedido/${data.code}?nuevo=1`);
    } catch {
      setServerError("No pudimos procesar el pedido. Probá de nuevo en unos segundos.");
    } finally {
      setSubmitting(false);
    }
  };

  if (hydrated && items.length === 0) {
    return (
      <div className="container-xl py-16">
        <div className="card-surface mx-auto flex max-w-lg flex-col items-center gap-3 px-8 py-14 text-center">
          <IconReceipt className="h-12 w-12 shrink-0 text-brand-700" />
          <h1 className="text-xl font-extrabold text-ink-900">No hay productos para pagar</h1>
          <p className="text-sm text-ink-500">Agregá productos al carrito y volvé para finalizar tu compra.</p>
          <Link href="/productos" className="mt-2 rounded-xl bg-brand-700 px-5 py-3 text-sm font-bold text-white">
            Ir al catálogo
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-xl py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 md:text-3xl">Finalizá tu compra</h1>
          <div className="mt-1 flex flex-wrap items-center gap-4 text-xs font-medium text-ink-500">
            <span className="flex items-center gap-1.5"><IconShield className="h-4 w-4 shrink-0 text-emerald-600" /> Compra protegida</span>
            <span className="flex items-center gap-1.5"><IconLock className="h-4 w-4 shrink-0 text-emerald-600" /> Datos cifrados</span>
            <span className="hidden sm:inline">Sin necesidad de crear cuenta</span>
          </div>
        </div>
        <Link href="/carrito" className="text-sm font-semibold text-ink-500 hover:text-brand-700">
          ← Volver al carrito
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-4">
          <section className="card-surface p-6 sm:p-8">
            <h2 className="mb-6 text-xl font-extrabold tracking-tight text-ink-900">Detalles de facturación</h2>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre" error={errors.firstName}>
                  <input className={inputClass} value={form.firstName} onChange={set("firstName")} placeholder="Juan" />
                </Field>
                <Field label="Apellidos" error={errors.lastName}>
                  <input className={inputClass} value={form.lastName} onChange={set("lastName")} placeholder="Pérez" />
                </Field>
              </div>
              <Field label="Email" error={errors.email} hint="Te enviamos la confirmación y el seguimiento acá.">
                <input className={inputClass} type="email" value={form.email} onChange={set("email")} placeholder="juan@email.com" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Teléfono / WhatsApp" error={errors.phone}>
                  <input className={inputClass} value={form.phone} onChange={set("phone")} placeholder="351 555 5555" />
                </Field>
                <Field label="DNI o CUIT" error={errors.docId} hint="Necesario para la factura.">
                  <input className={inputClass} value={form.docId} onChange={set("docId")} placeholder="30123456" />
                </Field>
              </div>
            </div>
          </section>

          <section className="card-surface p-6 sm:p-8">
            <h2 className="mb-6 text-xl font-extrabold tracking-tight text-ink-900">Entrega</h2>
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => chooseDelivery("standard")}
                  className={`rounded-2xl border p-4 text-left transition ${
                    deliveryMethod !== "pickup" ? "border-brand-500 bg-brand-50/50 ring-1 ring-brand-500/20" : "border-ink-100 bg-surface hover:bg-ink-50"
                  }`}
                >
                  <p className="flex items-center gap-2 text-sm font-extrabold text-ink-900"><IconTruck /> Envío a domicilio</p>
                  <p className="mt-1 text-xs text-ink-500">A todo el país con seguimiento online</p>
                </button>
                <button
                  type="button"
                  onClick={() => chooseDelivery("pickup")}
                  className={`rounded-2xl border p-4 text-left transition ${
                    deliveryMethod === "pickup" ? "border-brand-500 bg-brand-50/50 ring-1 ring-brand-500/20" : "border-ink-100 bg-surface hover:bg-ink-50"
                  }`}
                >
                  <p className="flex items-center gap-2 text-sm font-extrabold text-ink-900"><IconStore /> Retiro en el local</p>
                  <p className="mt-1 text-xs text-emerald-700">Gratis · 27 de Abril 180, Córdoba Capital</p>
                </button>
              </div>

              {deliveryMethod === "pickup" ? (
                <div className="rounded-xl bg-ink-50 p-4 text-sm text-ink-600">
                  <p className="font-bold text-ink-900">27 de Abril 180, Córdoba Capital</p>
                  <p className="mt-1 text-xs">Lunes a viernes de 14:00 a 18:30 · Sábados de 12:00 a 14:30</p>
                  <p className="mt-2 text-xs">
                    Te avisamos por WhatsApp cuando esté listo. Llevá tu DNI y el número de pedido.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
                    <Field label="Código postal" error={errors.zip}>
                      <input
                        className={inputClass}
                        value={form.zip}
                        onChange={set("zip")}
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="5000"
                      />
                    </Field>
                    <div className="flex items-end pb-1 text-xs text-ink-500">
                      {zipLoading ? (
                        <span className="flex items-center gap-2">
                          <Spinner className="h-4 w-4" /> Calculando envíos...
                        </span>
                      ) : zone ? (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700"><IconPin className="h-4 w-4 shrink-0 text-brand-700" /> Zona: {zone}</span>
                      ) : (
                        <span>Ingresá tu CP para ver costos y plazos.</span>
                      )}
                    </div>
                  </div>

                  {options.filter((o) => o.id !== "pickup").length ? (
                    <div className="space-y-2">
                      {options
                        .filter((option) => option.id !== "pickup")
                        .map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => chooseDelivery(option.id)}
                            className={`flex w-full items-start justify-between gap-3 rounded-2xl border p-4 text-left transition ${
                              deliveryMethod === option.id
                                ? "border-brand-500 bg-brand-50/40 ring-1 ring-brand-500/20"
                                : "border-ink-100 bg-surface hover:bg-ink-50"
                            }`}
                          >
                            <span>
                              <span className="block text-sm font-bold text-ink-900">{option.label}</span>
                              <span className="block text-xs text-ink-500">{option.description}</span>
                              <span className="mt-0.5 block text-xs font-semibold text-emerald-700">{option.eta}</span>
                            </span>
                            <span className={`text-sm font-extrabold ${option.free ? "text-emerald-700" : "text-ink-900"}`}>
                              {option.free ? "Gratis" : money(option.cost)}
                            </span>
                          </button>
                        ))}
                    </div>
                  ) : null}

                  <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
                    <Field label="Dirección de la calle" error={errors.street}>
                      <input className={inputClass} value={form.street} onChange={set("street")} placeholder="Número de la casa y nombre de la calle" />
                    </Field>
                    <Field label="Altura" error={errors.number}>
                      <input className={inputClass} value={form.number} onChange={set("number")} placeholder="1234" />
                    </Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Piso / Depto (opcional)">
                      <input className={inputClass} value={form.extra} onChange={set("extra")} placeholder="3° B" />
                    </Field>
                    <Field label="Localidad / Ciudad" error={errors.city}>
                      <input className={inputClass} value={form.city} onChange={set("city")} placeholder="Córdoba" />
                    </Field>
                    <Field label="Región / Provincia" error={errors.province}>
                      <select className={inputClass} value={form.province} onChange={set("province")}>
                        {PROVINCES.map((province) => (
                          <option key={province}>{province}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </>
              )}

              {errors.delivery ? <p role="alert" className="text-xs font-semibold text-rose-600">{errors.delivery}</p> : null}
            </div>
          </section>
        </div>

        {/* RESUMEN (Tu pedido) y MEDIO DE PAGO: van juntos en la columna derecha,
            en dos tarjetas, para que el comprador vea el pago sin otro paso. */}
        <aside className="self-start lg:sticky lg:top-36">
          <div className="space-y-6">
            <div className="card-surface space-y-4 p-6">
              <h2 className="text-xl font-extrabold tracking-tight text-ink-900">Tu pedido</h2>
            <div className="max-h-56 space-y-3 overflow-y-auto overscroll-contain data-lenis-prevent pr-1">
              {items.map((item) => (
                <div key={item.slug} className="flex items-center gap-3">
                  <ProductImg
                    src={item.image}
                    srcSet={item.imageSrcSet ?? []}
                    alt=""
                    sizes="48px"
                    width={48}
                    height={48}
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-xs font-semibold text-ink-800">{item.name}</p>
                    <div className="mt-1">
                      <div className="inline-flex items-center gap-2 rounded-lg border border-ink-100 bg-ink-50 px-1 text-[11px] text-ink-500">
                        <button
                          type="button"
                          aria-label="Quitar una unidad"
                          onClick={() => setQuantity(item.slug, item.quantity - 1)}
                          className="px-1.5 py-0.5"
                        >
                          −
                        </button>
                        <span className="font-bold tabular-nums text-ink-800">{item.quantity}</span>
                        <button
                          type="button"
                          aria-label="Agregar una unidad"
                          onClick={() => setQuantity(item.slug, item.quantity + 1)}
                          className="px-1.5 py-0.5"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-ink-900">{money(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>

            {coupon ? (
              <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-xs">
                <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700"><IconTicket className="h-4 w-4 shrink-0 text-brand-700" /> {coupon.code}</span>
                <button
                  type="button"
                  onClick={() => {
                    setCoupon(null);
                    writeCoupon(null);
                  }}
                  className="font-semibold text-emerald-700 underline"
                >
                  Quitar
                </button>
              </div>
            ) : (
              <form onSubmit={applyCoupon} className="flex gap-2">
                <input
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="Cupón de descuento"
                  className="h-9 flex-1 rounded-lg border border-ink-200 px-2.5 text-xs uppercase outline-none focus:border-brand-400"
                />
                <button type="submit" className="rounded-lg bg-brand-700 px-3 text-xs font-bold text-white">
                  Aplicar
                </button>
              </form>
            )}
            {couponError ? <p className="text-[11px] font-semibold text-rose-600">{couponError}</p> : null}

            <dl className="space-y-2 border-t border-ink-100 pt-3 text-sm">
              <div className="flex justify-between text-ink-600">
                <dt>Subtotal</dt>
                <dd>{money(totals.subtotal)}</dd>
              </div>
              {totals.couponDiscount > 0 ? (
                <div className="flex justify-between text-emerald-700">
                  <dt>Cupón {coupon?.code}</dt>
                  <dd>-{money(totals.couponDiscount)}</dd>
                </div>
              ) : null}
              {/* `paymentAdjustment` queda siempre en 0: el total no cambia por
                  medio de pago ni por cantidad de cuotas. Ver computeTotals. */}
              <div className="flex justify-between text-ink-600">
                <dt>Envío</dt>
                <dd className={selectedOption?.free ? "font-semibold text-emerald-700" : ""}>
                  {selectedOption ? (selectedOption.free ? "Gratis" : money(selectedOption.cost)) : "A calcular"}
                </dd>
              </div>
            </dl>

            <div className="flex items-end justify-between border-t border-ink-100 pt-3">
              <span className="text-sm font-semibold text-ink-600">Total</span>
              <div className="text-right">
                <span className="block text-2xl font-black text-ink-900">{money(totals.total)}</span>
              </div>
            </div>

            {totals.savings > 0 ? (
              <p className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                <IconTag className="h-4 w-4 shrink-0 text-brand-700" /> Estás ahorrando {money(totals.savings)}
              </p>
            ) : null}

            <ul className="space-y-1.5 border-t border-ink-100 pt-3 text-[11px] text-ink-500">
              <li className="flex items-center gap-1.5"><IconLock className="h-4 w-4 shrink-0 text-brand-700" /> Pago seguro · datos cifrados</li>
              <li className="flex items-center gap-1.5"><IconShield className="h-4 w-4 shrink-0 text-brand-700" /> 6 meses de garantía legal</li>
              <li className="flex items-center gap-1.5"><IconStore className="h-4 w-4 shrink-0 text-brand-700" /> Servicio técnico propio en el local</li>
            </ul>
            </div>

            {/* MEDIO DE PAGO: tarjeta aparte, igual que en la referencia. */}
            <div className="card-surface space-y-4 p-6">
              <h2 className="text-xl font-extrabold tracking-tight text-ink-900">Medio de pago</h2>
              <div className="grid gap-2">
                  {PAYMENT_METHODS.filter((method) =>
                  method.id === "transferencia" || (method.id === "efectivo" && deliveryMethod === "pickup"),
                ).map(
                    (method) => {
                      const PaymentIcon = PAYMENT_ICONS[method.id];
                      return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setPayment(method.id)}
                        {...(method.id === "mercadopago" ? { "data-mp-checkout-cta": "checkout-pro" } : {})}
                        className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${
                          payment === method.id ? "border-brand-500 bg-brand-50/50 ring-1 ring-brand-500/20" : "border-ink-100 bg-surface hover:bg-ink-50"
                        }`}
                      >
                        <span className={`mt-0.5 rounded-lg p-2 ${payment === method.id ? "bg-brand-100 text-brand-700" : "bg-ink-50 text-ink-400"}`}>
                          <PaymentIcon className="h-5 w-5 shrink-0" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2 text-sm font-extrabold text-ink-900">
                            {method.short}
                            {method.perk ? (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                {method.perk}
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 block text-xs leading-snug text-ink-500">{method.description}</span>
                        </span>
                      </button>
                      );
                    },
                  )}
                </div>

                {/* Mercado Pago y USDT quedan ocultos hasta que el negocio los
                    habilite formalmente; hoy se muestran solo transferencia y
                    efectivo/seña en el local. */}

                {payment === "transferencia" ? (
                  <div className="rounded-xl bg-ink-50 p-4 text-sm text-ink-700">
                    <p className="font-bold text-ink-900">Te enviamos el CBU o el alias para transferir.</p>
                    <p className="mt-1 text-xs">
                      Nos avisás cuando lo hagas y despachamos. La reserva de stock por tiempo limitado no se anuncia
                      hasta que el cliente confirme la política.
                    </p>
                  </div>
                ) : null}

                {payment === "efectivo" ? (
                  <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
                    <p className="font-bold">Pagás al retirar en el local.</p>
                    {/* Acá decía "Reservamos el producto por 48 horas hábiles a
                        tu nombre". Es un compromiso operativo que no está en el
                        sitio original y que el cliente tendría que confirmar. */}
                  </div>
                ) : null}

                <Field label="Comentarios para la entrega (opcional)">
                  <textarea
                    value={form.notes}
                    onChange={set("notes")}
                    rows={2}
                    placeholder="Ej: entregar después de las 14 hs, dejar en portería..."
                    className="w-full rounded-xl border border-ink-200 p-3 text-sm outline-none focus:border-brand-400"
                  />
                </Field>

                <label className="flex items-start gap-2.5 text-xs text-ink-600" data-error={errors.terms ? "terms" : undefined}>
                  <input
                    type="checkbox"
                    checked={terms}
                    onChange={(e) => setTerms(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-brand-600"
                  />
                  <span>
                    Acepto los <Link href="/ayuda" className="font-semibold text-brand-700 underline">términos y condiciones</Link> y
                    la política de privacidad de Córdoba Digital.
                  </span>
                </label>
                {errors.terms ? <p role="alert" className="text-xs font-semibold text-rose-600">{errors.terms}</p> : null}
                {serverError ? (
                  <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{serverError}</p>
                ) : null}

                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-brand-500 text-[15px] font-extrabold text-deep transition hover:bg-brand-400 disabled:opacity-40"
                >
                  {submitting ? <Spinner className="h-4 w-4" /> : null}
                  Confirmar pedido · {money(totals.total)}
                </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
