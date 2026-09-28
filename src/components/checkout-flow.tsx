"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ProductImg } from "@/components/product-img";
import { useStore } from "@/components/store-provider";
import { Spinner } from "@/components/ui";
import { readCoupon, writeCoupon } from "@/lib/coupon-storage";
import { INSTALLMENT_PLANS, money } from "@/lib/format";
import { computeTotals, PAYMENT_METHODS, type CouponInfo, type PaymentMethodId } from "@/lib/pricing";
import type { DeliveryMethod, ShippingOption } from "@/lib/shipping";

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
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-500">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs font-semibold text-rose-600">{error}</span> : null}
      {!error && hint ? <span className="mt-1 block text-[11px] text-ink-400">{hint}</span> : null}
    </label>
  );
}

const inputClass =
  "h-11 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink-900 outline-none transition placeholder:text-ink-300 focus:border-brand-400 focus:ring-4 focus:ring-brand-100";

export function CheckoutFlow() {
  const router = useRouter();
  const { items, subtotal, listSubtotal, hydrated, clearCart, setQuantity } = useStore();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("standard");
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [zone, setZone] = useState<string | null>(null);
  const [zipLoading, setZipLoading] = useState(false);
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

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem("cd_checkout_v1", JSON.stringify({ ...form, notes: "" }));
  }, [form, hydrated]);

  // Quote shipping whenever the ZIP or subtotal changes.
  useEffect(() => {
    const zip = form.zip.replace(/\D/g, "").slice(0, 4);
    let cancelled = false;
    if (zip.length !== 4) {
      const id = window.setTimeout(() => {
        if (cancelled) return;
        setOptions([]);
        setZone(null);
      }, 0);
      return () => {
        cancelled = true;
        window.clearTimeout(id);
      };
    }
    const id = window.setTimeout(async () => {
      if (cancelled) return;
      setZipLoading(true);
      try {
        const res = await fetch("/api/shipping", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ zip, subtotal }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (data.ok) {
          setOptions(data.options as ShippingOption[]);
          setZone(data.zone as string);
        } else {
          setOptions([]);
          setZone(null);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setZipLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [form.zip, subtotal]);

  const selectedOption = useMemo(() => {
    if (deliveryMethod === "pickup") {
      return {
        id: "pickup" as DeliveryMethod,
        label: "Retiro en el local",
        description: "27 de Abril 259, Córdoba Capital",
        eta: "Listo en 2 horas hábiles",
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

  // Sincroniza método de pago con entrega: efectivo solo válido con retiro.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (deliveryMethod !== "pickup" && payment === "efectivo") setPayment("transferencia");
  }, [deliveryMethod, payment]);

  const set = (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validateStep1 = () => {
    const next: Record<string, string> = {};
    if (form.firstName.trim().length < 2) next.firstName = "Ingresá tu nombre.";
    if (form.lastName.trim().length < 2) next.lastName = "Ingresá tu apellido.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) next.email = "Ingresá un email válido.";
    if (form.phone.replace(/\D/g, "").length < 8) next.phone = "Ingresá tu teléfono (con característica).";
    if (form.docId.replace(/\D/g, "").length < 7) next.docId = "Necesitamos tu DNI o CUIT para facturar.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const validateStep2 = () => {
    const next: Record<string, string> = {};
    if (deliveryMethod !== "pickup") {
      if (form.zip.replace(/\D/g, "").length !== 4) next.zip = "Código postal de 4 dígitos.";
      if (form.street.trim().length < 3) next.street = "Ingresá la calle.";
      if (form.number.trim().length < 1) next.number = "Altura.";
      if (form.city.trim().length < 2) next.city = "Ingresá la localidad.";
      if (!selectedOption) next.delivery = "Elegí una forma de envío.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

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

  const submit = async () => {
    if (!validateStep1()) {
      setStep(1);
      return;
    }
    if (!validateStep2()) {
      setStep(2);
      return;
    }
    if (!terms) {
      setErrors({ terms: "Tenés que aceptar los términos para continuar." });
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
          setStep(Object.keys(data.errors)[0] in { firstName: 1, lastName: 1, email: 1, phone: 1, docId: 1 } ? 1 : 2);
        }
        setServerError(data.error ?? "Revisá los datos marcados en rojo.");
        return;
      }
      clearCart();
      writeCoupon(null);
      if (payment === "mercadopago") {
        try {
          const pref = await fetch("/api/checkout/mercadopago", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: data.code }),
          });
          const prefData = await pref.json();
          if (pref.ok && prefData.ok && prefData.init_point) {
            window.location.href = prefData.init_point as string;
            return;
          }
          setServerError(
            prefData.error ??
              "Creamos tu pedido pero no pudimos abrir Mercado Pago. Entrá a Seguimiento para reintentar.",
          );
          router.push(`/pedido/${data.code}?nuevo=1&mp=pendiente`);
          return;
        } catch {
          router.push(`/pedido/${data.code}?nuevo=1&mp=pendiente`);
          return;
        }
      }
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
          <span className="text-5xl">ðŸ§¾</span>
          <h1 className="text-xl font-extrabold text-ink-900">No hay productos para pagar</h1>
          <p className="text-sm text-ink-500">Agregá productos al carrito y volvé para finalizar tu compra.</p>
          <Link href="/productos" className="mt-2 rounded-xl bg-ink-900 px-5 py-3 text-sm font-bold text-white">
            Ir al catálogo
          </Link>
        </div>
      </div>
    );
  }

  const steps = [
    { id: 1, label: "Tus datos" },
    { id: 2, label: "Entrega" },
    { id: 3, label: "Pago" },
  ];

  return (
    <div className="container-xl py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 md:text-3xl">Finalizá tu compra</h1>
          <p className="text-sm text-ink-500">Compra protegida · ðŸ”’ datos cifrados · sin necesidad de crear cuenta</p>
        </div>
        <Link href="/carrito" className="text-sm font-semibold text-ink-500 hover:text-brand-700">
          â† Volver al carrito
        </Link>
      </div>

      <ol className="mb-8 flex items-center gap-3">
        {steps.map((item, index) => {
          const done = step > item.id;
          const active = step === item.id;
          return (
            <li key={item.id} className="flex flex-1 items-center gap-3">
              <button
                type="button"
                onClick={() => setStep(item.id)}
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold transition ${
                  active ? "bg-ink-900 text-white" : done ? "bg-emerald-50 text-emerald-700" : "bg-white text-ink-400"
                }`}
              >
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full text-xs ${
                    active ? "bg-white/20" : done ? "bg-emerald-500 text-white" : "bg-ink-100"
                  }`}
                >
                  {done ? "âœ“" : item.id}
                </span>
                {item.label}
              </button>
              {index < steps.length - 1 ? <span className="hidden h-px flex-1 bg-ink-200 sm:block" /> : null}
            </li>
          );
        })}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[1fr_23rem]">
        <div className="space-y-4">
          {/* STEP 1 */}
          <section className={`card-surface p-5 ${step === 1 ? "" : "opacity-95"}`}>
            <header className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-ink-900">1. Tus datos</h2>
              {step !== 1 ? (
                <button type="button" onClick={() => setStep(1)} className="text-xs font-bold text-brand-700">
                  Editar
                </button>
              ) : null}
            </header>

            {step === 1 ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nombre" error={errors.firstName}>
                    <input className={inputClass} value={form.firstName} onChange={set("firstName")} placeholder="Juan" />
                  </Field>
                  <Field label="Apellido" error={errors.lastName}>
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
                <button
                  type="button"
                  onClick={() => validateStep1() && setStep(2)}
                  className="w-full rounded-xl bg-ink-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-700 sm:w-auto sm:px-8"
                >
                  Continuar
                </button>
              </div>
            ) : (
              <p className="text-sm text-ink-600">
                {form.firstName} {form.lastName} · {form.email} · {form.phone}
              </p>
            )}
          </section>

          {/* STEP 2 */}
          <section className="card-surface p-5">
            <header className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-ink-900">2. Entrega</h2>
              {step !== 2 && step > 2 ? (
                <button type="button" onClick={() => setStep(2)} className="text-xs font-bold text-brand-700">
                  Editar
                </button>
              ) : null}
            </header>

            {step === 2 ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod("standard")}
                    className={`rounded-xl border-2 p-4 text-left transition ${
                      deliveryMethod !== "pickup" ? "border-brand-500 bg-brand-50/50" : "border-ink-100 hover:border-ink-300"
                    }`}
                  >
                    <p className="text-sm font-extrabold text-ink-900">ðŸšš Envío a domicilio</p>
                    <p className="mt-1 text-xs text-ink-500">A todo el país con seguimiento online</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod("pickup")}
                    className={`rounded-xl border-2 p-4 text-left transition ${
                      deliveryMethod === "pickup" ? "border-brand-500 bg-brand-50/50" : "border-ink-100 hover:border-ink-300"
                    }`}
                  >
                    <p className="text-sm font-extrabold text-ink-900">ðŸ¬ Retiro en el local</p>
                    <p className="mt-1 text-xs text-emerald-600">Gratis · listo en 2 horas</p>
                  </button>
                </div>

                {deliveryMethod === "pickup" ? (
                  <div className="rounded-xl bg-ink-50 p-4 text-sm text-ink-600">
                    <p className="font-bold text-ink-900">27 de Abril 259, Córdoba Capital</p>
                    <p className="mt-1 text-xs">Lunes a viernes de 14:00 a 18:30 · Sábados de 11:00 a 14:00</p>
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
                          <span className="font-semibold text-emerald-600">ðŸ“ Zona: {zone}</span>
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
                              onClick={() => setDeliveryMethod(option.id)}
                              className={`flex w-full items-start justify-between gap-3 rounded-xl border-2 p-4 text-left transition ${
                                deliveryMethod === option.id
                                  ? "border-brand-500 bg-brand-50/40"
                                  : "border-ink-100 hover:border-ink-300"
                              }`}
                            >
                              <span>
                                <span className="block text-sm font-bold text-ink-900">{option.label}</span>
                                <span className="block text-xs text-ink-500">{option.description}</span>
                                <span className="mt-0.5 block text-xs font-semibold text-emerald-600">{option.eta}</span>
                              </span>
                              <span className={`text-sm font-extrabold ${option.free ? "text-emerald-600" : "text-ink-900"}`}>
                                {option.free ? "Gratis" : money(option.cost)}
                              </span>
                            </button>
                          ))}
                      </div>
                    ) : null}

                    <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
                      <Field label="Calle" error={errors.street}>
                        <input className={inputClass} value={form.street} onChange={set("street")} placeholder="Av. Colón" />
                      </Field>
                      <Field label="Altura" error={errors.number}>
                        <input className={inputClass} value={form.number} onChange={set("number")} placeholder="1234" />
                      </Field>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field label="Piso / Depto (opcional)">
                        <input className={inputClass} value={form.extra} onChange={set("extra")} placeholder="3° B" />
                      </Field>
                      <Field label="Localidad" error={errors.city}>
                        <input className={inputClass} value={form.city} onChange={set("city")} placeholder="Córdoba" />
                      </Field>
                      <Field label="Provincia">
                        <select className={inputClass} value={form.province} onChange={set("province")}>
                          {PROVINCES.map((province) => (
                            <option key={province}>{province}</option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  </>
                )}

                {errors.delivery ? <p className="text-xs font-semibold text-rose-600">{errors.delivery}</p> : null}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="rounded-xl border border-ink-200 px-5 py-3 text-sm font-bold text-ink-600"
                  >
                    Atrás
                  </button>
                  <button
                    type="button"
                    onClick={() => validateStep2() && setStep(3)}
                    className="flex-1 rounded-xl bg-ink-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-700 sm:flex-none sm:px-8"
                  >
                    Continuar al pago
                  </button>
                </div>
              </div>
            ) : step > 2 ? (
              <p className="text-sm text-ink-600">
                {deliveryMethod === "pickup"
                  ? "Retiro en 27 de Abril 259, Córdoba Capital"
                  : `${form.street} ${form.number}, ${form.city} (CP ${form.zip}) · ${selectedOption?.label ?? ""}`}
              </p>
            ) : (
              <p className="text-sm text-ink-400">Completá tus datos para elegir la entrega.</p>
            )}
          </section>

          {/* STEP 3 */}
          <section className="card-surface p-5">
            <header className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-ink-900">3. Pago</h2>
            </header>

            {step === 3 ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {PAYMENT_METHODS.filter((method) => method.id !== "efectivo" || deliveryMethod === "pickup").map(
                    (method) => (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setPayment(method.id)}
                        {...(method.id === "mercadopago" ? { "data-mp-checkout-cta": "checkout-pro" } : {})}
                        className={`rounded-xl border-2 p-4 text-left transition ${
                          payment === method.id ? "border-brand-500 bg-brand-50/40" : "border-ink-100 hover:border-ink-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-extrabold text-ink-900">
                            {method.icon} {method.short}
                          </span>
                          {method.perk ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                              {method.perk}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1.5 text-xs leading-snug text-ink-500">{method.description}</p>
                      </button>
                    ),
                  )}
                </div>

                {payment === "tarjeta" ? (
                  <div className="rounded-xl border border-ink-100 p-4">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-500">Elegí tu plan de cuotas</p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {INSTALLMENT_PLANS.map((plan) => {
                        const planTotals = computeTotals({
                          subtotal,
                          coupon,
                          shippingCost: selectedOption?.cost ?? 0,
                          paymentMethod: "tarjeta",
                          installments: plan.count,
                        });
                        return (
                          <button
                            key={plan.count}
                            type="button"
                            onClick={() => setInstallments(plan.count)}
                            className={`rounded-xl border-2 p-3 text-left transition ${
                              installments === plan.count
                                ? "border-brand-500 bg-brand-50/50"
                                : "border-ink-100 hover:border-ink-300"
                            }`}
                          >
                            <p className="text-sm font-extrabold text-ink-900">
                              {plan.count}x {money(planTotals.installmentAmount)}
                            </p>
                            <p className="text-[11px] text-ink-500">
                              {plan.coefficient === 1 ? "Sin interés" : `Total ${money(planTotals.total)}`}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-3 text-[11px] text-ink-400">
                      El cobro se procesa de forma segura con Mercado Pago. Nunca almacenamos los datos de tu tarjeta.
                    </p>
                  </div>
                ) : null}

                {payment === "transferencia" ? (
                  <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
                    <p className="font-bold">¡Buena elección! Te ahorrás {money(Math.abs(totals.paymentAdjustment))}.</p>
                    <p className="mt-1 text-xs">
                      Al confirmar te mostramos el CBU / alias y la wallet USDT. Tenés 48 hs para transferir y el stock
                      queda reservado.
                    </p>
                  </div>
                ) : null}

                {payment === "efectivo" ? (
                  <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
                    <p className="font-bold">Pagás al retirar en el local.</p>
                    <p className="mt-1 text-xs">Reservamos el producto por 48 horas hábiles a tu nombre.</p>
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

                <label className="flex items-start gap-2.5 text-xs text-ink-600">
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
                {errors.terms ? <p className="text-xs font-semibold text-rose-600">{errors.terms}</p> : null}
                {serverError ? (
                  <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{serverError}</p>
                ) : null}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="rounded-xl border border-ink-200 px-5 py-3 text-sm font-bold text-ink-600"
                  >
                    Atrás
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={submitting}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-brand-600/25 transition hover:from-brand-700 hover:to-brand-600 disabled:opacity-60"
                  >
                    {submitting ? <Spinner className="h-4 w-4" /> : null}
                    Confirmar pedido · {money(totals.total)}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-ink-400">Elegí cómo querés pagar en el último paso.</p>
            )}
          </section>
        </div>

        {/* SUMMARY */}
        <aside>
          <div className="card-surface sticky top-36 space-y-4 p-5">
            <h2 className="text-lg font-extrabold text-ink-900">Tu pedido</h2>
            <div className="max-h-56 space-y-3 overflow-y-auto pr-1">
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
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-400">
                      <button
                        type="button"
                        onClick={() => setQuantity(item.slug, item.quantity - 1)}
                        className="h-5 w-5 rounded border border-ink-200"
                      >
                        âˆ’
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => setQuantity(item.slug, item.quantity + 1)}
                        className="h-5 w-5 rounded border border-ink-200"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-ink-900">{money(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>

            {coupon ? (
              <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-xs">
                <span className="font-bold text-emerald-700">ðŸŽŸï¸ {coupon.code}</span>
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
                <button type="submit" className="rounded-lg bg-ink-900 px-3 text-xs font-bold text-white">
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
                <div className="flex justify-between text-emerald-600">
                  <dt>Cupón {coupon?.code}</dt>
                  <dd>-{money(totals.couponDiscount)}</dd>
                </div>
              ) : null}
              {totals.paymentAdjustment !== 0 ? (
                <div className={`flex justify-between ${totals.paymentAdjustment < 0 ? "text-emerald-600" : "text-ink-600"}`}>
                  <dt>{totals.paymentAdjustment < 0 ? "Descuento por medio de pago" : "Interés de financiación"}</dt>
                  <dd>
                    {totals.paymentAdjustment < 0 ? "-" : "+"}
                    {money(Math.abs(totals.paymentAdjustment))}
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between text-ink-600">
                <dt>Envío</dt>
                <dd className={selectedOption?.free ? "font-semibold text-emerald-600" : ""}>
                  {selectedOption ? (selectedOption.free ? "Gratis" : money(selectedOption.cost)) : "A calcular"}
                </dd>
              </div>
            </dl>

            <div className="flex items-end justify-between border-t border-ink-100 pt-3">
              <span className="text-sm font-semibold text-ink-600">Total</span>
              <div className="text-right">
                <span className="block text-2xl font-black text-ink-900">{money(totals.total)}</span>
                {payment === "tarjeta" && installments > 1 ? (
                  <span className="text-[11px] text-ink-400">
                    {installments} cuotas de {money(totals.installmentAmount)}
                  </span>
                ) : null}
              </div>
            </div>

            {totals.savings > 0 ? (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                ðŸŽ‰ Estás ahorrando {money(totals.savings)}
              </p>
            ) : null}

            <ul className="space-y-1.5 border-t border-ink-100 pt-3 text-[11px] text-ink-500">
              <li>ðŸ”’ Pago seguro · datos cifrados</li>
              <li>ðŸ›¡ï¸ Garantía oficial y factura</li>
              <li>ðŸ”„ 10 días para cambios</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
