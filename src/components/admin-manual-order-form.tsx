"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AdminIcon } from "@/components/admin-icon";
import { adminBtn, adminChip } from "@/components/admin-ui";
import { whatsappHref } from "@/lib/admin-order-helpers";
import { CHECKOUT_PAYMENT_METHODS, isPaymentMethodOffered } from "@/lib/checkout-payment";
import { money } from "@/lib/format";
import { MAX_QTY_PER_ITEM, PAYMENT_METHODS, type PaymentMethodId } from "@/lib/pricing";

type Found = { slug: string; name: string; sku: string; price: number; stock: number; image: string };
type Line = Found & { quantity: number };
type Delivery = "pickup" | "standard" | "express";
type Created = { code: string; total: number; link: string };

const DELIVERIES: { id: Delivery; label: string; hint: string }[] = [
  { id: "pickup", label: "Retira en el local", hint: "27 de Abril 180, sin costo" },
  { id: "standard", label: "Envío a domicilio", hint: "Andreani, se cotiza al cargar" },
  { id: "express", label: "Envío en el día", hint: "Solo Córdoba capital" },
];

const field = "h-10 w-full px-3 text-sm";
const label = "flex flex-col gap-1.5 text-[13px] text-[#9a9ea7]";
const card = "admin-card flex flex-col gap-4 rounded-2xl p-5";

/** Mismo tope que el checkout: el stock 1 migrado de WooCommerce es "hay", no una cantidad. */
function capFor(stock: number): number {
  return stock > 1 ? Math.min(stock, MAX_QTY_PER_ITEM) : stock === 0 ? 0 : MAX_QTY_PER_ITEM;
}

function FieldError({ text }: { text?: string }) {
  return text ? <span className="text-xs text-red-600">{text}</span> : null;
}

/**
 * Formulario del pedido manual. Los precios que se ven acá son orientativos:
 * el servidor vuelve a calcular precio, stock y envío al guardar.
 */
export function AdminManualOrderForm({ mercadoPago }: { mercadoPago: boolean }) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [searching, setSearching] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [customer, setCustomer] = useState({ firstName: "", lastName: "", email: "", phone: "", docId: "" });
  const [delivery, setDelivery] = useState<Delivery>("pickup");
  const [address, setAddress] = useState({ street: "", number: "", extra: "", city: "Córdoba", province: "Córdoba", zip: "" });
  const [payment, setPayment] = useState<PaymentMethodId>("transferencia");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);

  const payments = PAYMENT_METHODS.filter(
    (p) => (CHECKOUT_PAYMENT_METHODS.includes(p.id) || p.id === "mercadopago") && isPaymentMethodOffered(p.id, delivery, { mercadoPago }),
  );
  const paymentOk = payments.some((p) => p.id === payment);

  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/products?q=${encodeURIComponent(text)}&stock=con&perPage=8`, { signal: controller.signal });
        const data = (await res.json()) as { ok: boolean; items?: Found[] };
        setFound(data.ok ? (data.items ?? []) : []);
      } catch {
        // búsqueda cancelada por otra más nueva
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  function add(product: Found) {
    setLines((current) => {
      const existing = current.find((l) => l.slug === product.slug);
      if (existing) {
        return current.map((l) => (l.slug === product.slug ? { ...l, quantity: Math.min(l.quantity + 1, capFor(l.stock)) } : l));
      }
      return [...current, { ...product, quantity: 1 }];
    });
    setQ("");
    setFound([]);
  }

  function setQuantity(slug: string, quantity: number) {
    setLines((current) => current.map((l) => (l.slug === slug ? { ...l, quantity: Math.max(1, Math.min(quantity, capFor(l.stock))) } : l)));
  }

  const subtotal = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setErrors({});
    if (!lines.length) {
      setError("Agregá al menos un producto.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/orders/manual", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({ slug: l.slug, quantity: l.quantity })),
          customer,
          delivery: delivery === "pickup" ? { method: "pickup" } : { method: delivery, ...address },
          payment: { method: payment },
          notes,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; errors?: Record<string, string> } & Partial<Created>;
      if (!data.ok || !data.code) {
        setErrors(data.errors ?? {});
        setError(data.error ?? (data.errors ? "Revisá los datos marcados." : "No se pudo cargar el pedido."));
        return;
      }
      setCreated({ code: data.code, total: data.total ?? 0, link: data.link ?? "" });
    } catch {
      setError("No se pudo cargar el pedido. Probá de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  if (created) {
    const message = `Hola ${customer.firstName}! Te dejo el link de tu pedido ${created.code} en Córdoba Digital (total ${money(created.total)}). Desde ahí ves el detalle y cómo pagar: ${created.link}`;
    const wa = whatsappHref(customer.phone, message);
    return (
      <section className={`${card} max-w-2xl`}>
        <span className="grid h-11 w-11 place-items-center rounded-full bg-emerald-50 text-emerald-700">
          <AdminIcon name="pedidos" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-white">Pedido {created.code} cargado</h2>
          <p className="text-sm text-[#9a9ea7]">
            Total {money(created.total)}. Quedó pendiente de pago con el stock reservado. Mandale el link al cliente: ahí ve el detalle y paga con el medio elegido.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2 pl-3">
          <span className="admin-mono min-w-0 flex-1 truncate text-[13px] text-[#d5d8de]">{created.link}</span>
          <button
            type="button"
            className={adminChip}
            onClick={async () => {
              await navigator.clipboard?.writeText(created.link).catch(() => undefined);
              setCopied(true);
            }}
          >
            {copied ? "Copiado" : "Copiar link"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {wa ? (
            <a href={wa} target="_blank" rel="noreferrer" className={adminBtn}>
              Mandar por WhatsApp
            </a>
          ) : null}
          <Link href={`/admin/pedidos/${created.code}`} className={adminChip}>
            Ver pedido
          </Link>
          <button
            type="button"
            className={adminChip}
            onClick={() => {
              setCreated(null);
              setCopied(false);
              setLines([]);
              setCustomer({ firstName: "", lastName: "", email: "", phone: "", docId: "" });
              setNotes("");
            }}
          >
            Cargar otro
          </button>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]" noValidate>
      <div className="flex min-w-0 flex-col gap-5">
        <section className={card}>
          <h2 className="text-base font-semibold text-white">Productos</h2>
          <div className="relative">
            <input
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                if (event.target.value.trim().length < 2) setFound([]);
              }}
              placeholder="Buscar por nombre, SKU o marca…"
              aria-label="Buscar producto"
              className={field}
            />
            {q.trim().length >= 2 ? (
              <ul className="absolute inset-x-0 top-12 z-10 max-h-80 overflow-y-auto rounded-xl border border-white/10 bg-[#15171c] p-1.5 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.9)]">
                {found.length === 0 ? (
                  <li className="px-3 py-3 text-sm text-[#9a9ea7]">{searching ? "Buscando…" : "No hay productos con stock que coincidan."}</li>
                ) : (
                  found.map((product) => (
                    <li key={product.slug}>
                      <button
                        type="button"
                        onClick={() => add(product)}
                        className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm text-[#d5d8de] hover:bg-white/[0.07]"
                      >
                        {product.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={product.image} alt="" className="h-9 w-9 shrink-0 rounded-lg bg-white object-contain" />
                        ) : (
                          <span className="h-9 w-9 shrink-0 rounded-lg bg-white/[0.06]" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{product.name}</span>
                          <span className="block text-xs text-[#80848d]">
                            {product.sku ? `${product.sku} · ` : ""}stock {product.stock}
                          </span>
                        </span>
                        <span className="tabular-nums">{money(product.price)}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </div>
          {lines.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-[#80848d]">
              Buscá un producto y tocalo para sumarlo al pedido.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-white/[0.06]">
              {lines.map((line) => (
                <li key={line.slug} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="min-w-0 flex-[1_1_200px]">
                    <span className="block truncate text-sm text-white">{line.name}</span>
                    <span className="block text-xs text-[#80848d]">{money(line.price)} c/u</span>
                  </span>
                  <span className="inline-flex items-center rounded-full border border-white/10">
                    <button type="button" aria-label="Uno menos" onClick={() => setQuantity(line.slug, line.quantity - 1)} className="h-8 w-8 text-[#d5d8de]">
                      −
                    </button>
                    <span className="w-6 text-center text-sm tabular-nums text-white">{line.quantity}</span>
                    <button type="button" aria-label="Uno más" onClick={() => setQuantity(line.slug, line.quantity + 1)} className="h-8 w-8 text-[#d5d8de]">
                      +
                    </button>
                  </span>
                  <span className="w-28 text-right text-sm tabular-nums text-white">{money(line.price * line.quantity)}</span>
                  <button
                    type="button"
                    onClick={() => setLines((current) => current.filter((l) => l.slug !== line.slug))}
                    className="text-xs text-[#9a9ea7] hover:text-red-600"
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={card}>
          <h2 className="text-base font-semibold text-white">Cliente</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["firstName", "Nombre", "text"],
                ["lastName", "Apellido", "text"],
                ["phone", "Celular", "tel"],
                ["email", "Email", "email"],
                ["docId", "DNI o CUIT", "text"],
              ] as const
            ).map(([key, text, type]) => (
              <label key={key} className={label}>
                {text}
                <input
                  type={type}
                  value={customer[key]}
                  onChange={(event) => setCustomer((c) => ({ ...c, [key]: event.target.value }))}
                  className={field}
                  aria-invalid={!!errors[key]}
                />
                <FieldError text={errors[key]} />
              </label>
            ))}
          </div>
        </section>

        <section className={card}>
          <h2 className="text-base font-semibold text-white">Entrega</h2>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {DELIVERIES.map((option) => (
              <label
                key={option.id}
                className={`flex cursor-pointer flex-col gap-0.5 rounded-xl border px-3.5 py-3 text-sm ${delivery === option.id ? "border-brand-500/60 bg-brand-500/10 text-white" : "border-white/10 text-[#d5d8de]"}`}
              >
                <input type="radio" name="delivery" value={option.id} checked={delivery === option.id} onChange={() => setDelivery(option.id)} className="sr-only" />
                {option.label}
                <span className="text-xs text-[#80848d]">{option.hint}</span>
              </label>
            ))}
          </div>
          {delivery === "pickup" ? null : (
            <div className="grid gap-4 sm:grid-cols-6">
              {(
                [
                  ["street", "Calle", "sm:col-span-4"],
                  ["number", "Número", "sm:col-span-2"],
                  ["extra", "Piso, depto (opcional)", "sm:col-span-2"],
                  ["zip", "Código postal", "sm:col-span-2"],
                  ["city", "Ciudad", "sm:col-span-2"],
                  ["province", "Provincia", "sm:col-span-3"],
                ] as const
              ).map(([key, text, span]) => (
                <label key={key} className={`${label} ${span}`}>
                  {text}
                  <input
                    value={address[key]}
                    onChange={(event) => setAddress((a) => ({ ...a, [key]: event.target.value }))}
                    inputMode={key === "zip" || key === "number" ? "numeric" : undefined}
                    className={field}
                    aria-invalid={!!errors[key]}
                  />
                  <FieldError text={errors[key]} />
                </label>
              ))}
            </div>
          )}
          <FieldError text={errors.delivery} />
        </section>
      </div>

      <aside className="flex flex-col gap-5 lg:sticky lg:top-6 lg:self-start">
        <section className={card}>
          <h2 className="text-base font-semibold text-white">Pago</h2>
          <div className="flex flex-col gap-2">
            {payments.map((option) => (
              <label
                key={option.id}
                className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm ${payment === option.id ? "border-brand-500/60 bg-brand-500/10 text-white" : "border-white/10 text-[#d5d8de]"}`}
              >
                <input type="radio" name="payment" value={option.id} checked={payment === option.id} onChange={() => setPayment(option.id)} className="accent-brand-500" />
                {option.short}
              </label>
            ))}
          </div>
          {!paymentOk ? <span className="text-xs text-amber-700">Elegí un medio de pago para esta entrega.</span> : null}
          <FieldError text={errors.payment} />
          <label className={label}>
            Nota interna (opcional)
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} rows={3} className="w-full px-3 py-2 text-sm" />
          </label>
        </section>

        <section className={card}>
          <div className="flex items-baseline justify-between text-sm text-[#9a9ea7]">
            <span>Subtotal</span>
            <span className="tabular-nums text-white">{money(subtotal)}</span>
          </div>
          <p className="text-xs text-[#80848d]">El envío y el total final los calcula el sistema al guardar, con los precios y el stock del momento.</p>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button type="submit" disabled={saving || !paymentOk} className={`${adminBtn} justify-center disabled:opacity-60`}>
            {saving ? "Cargando…" : "Cargar pedido"}
          </button>
        </section>
      </aside>
    </form>
  );
}
