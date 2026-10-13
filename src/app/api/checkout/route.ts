import { eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { orderItems, orders, products, type ShippingAddress } from "@/db/schema";
import { computeTotals, MAX_QTY_PER_ITEM, PAYMENT_METHODS, type PaymentMethodId } from "@/lib/pricing";
import { ensureOrderStockSchema, reserveOrderStock } from "@/lib/order-status";
import { claimCouponUse, CouponGoneError } from "@/lib/coupons";
import { getCoupon } from "@/lib/queries";
import { resolvePaymentMethod } from "@/lib/checkout-payment";
import { mercadoPagoReady } from "@/lib/mercadopago";
import { validateDelivery, validatePersonalData } from "@/lib/checkout-validation";
import { findShippingOption, normalizeZip, type DeliveryMethod } from "@/lib/shipping";
import { preciosAndreani } from "@/lib/shipping-andreani";
import { andreaniConfigurado, AndreaniError, sucursales } from "@/lib/andreani";

export const dynamic = "force-dynamic";

type CheckoutBody = {
  items?: { slug: string; quantity: number }[];
  customer?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    docId?: string;
  };
  delivery?: {
    method?: DeliveryMethod;
    zip?: string;
    street?: string;
    number?: string;
    extra?: string;
    city?: string;
    province?: string;
    /** Código de la sucursal de Andreani, solo para "express" (a sucursal). */
    branch?: string;
  };
  payment?: { method?: PaymentMethodId; installments?: number };
  couponCode?: string | null;
  notes?: string;
};

function orderCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  // El código es la llave para ver el pedido en /pedido/[code]: tiene que salir
  // de un generador criptográfico, no de Math.random (predecible). 256 es
  // múltiplo de 32, así que el módulo no sesga.
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let suffix = "";
  for (const byte of bytes) {
    suffix += alphabet[byte % alphabet.length];
  }
  return `CD-${suffix}`;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  // `?? {}` cubre un body `null`; `text` evita un 500 si un campo no es texto.
  const body = ((await request.json().catch(() => ({}))) ?? {}) as CheckoutBody;
  const errors: Record<string, string> = {};

  // El mismo producto puede venir en dos líneas: se suman antes de validar, así
  // el tope por producto vale para el total y no para cada línea.
  const rawItems: unknown[] = Array.isArray(body.items) ? body.items : [];
  const merged = new Map<string, number>();
  for (const raw of rawItems) {
    const item = raw as { slug?: unknown; quantity?: unknown } | null;
    const quantity = Number(item?.quantity);
    if (!item || typeof item.slug !== "string" || !Number.isFinite(quantity) || quantity <= 0) continue;
    merged.set(item.slug, (merged.get(item.slug) ?? 0) + Math.floor(quantity));
  }
  const items = [...merged].map(([slug, quantity]) => ({ slug, quantity }));
  if (!items.length) {
    return Response.json({ ok: false, error: "Tu carrito está vacío." }, { status: 400 });
  }

  const customer = body.customer ?? {};
  const firstName = text(customer.firstName);
  const lastName = text(customer.lastName);
  const email = text(customer.email).toLowerCase();
  const phone = text(customer.phone);
  const docId = text(customer.docId);

  Object.assign(errors, validatePersonalData({ firstName, lastName, email, phone, docId }));

  const delivery = body.delivery ?? {};
  const method: DeliveryMethod = delivery.method === "pickup" || delivery.method === "express" ? delivery.method : "standard";
  const zip = normalizeZip(text(delivery.zip));
  let address: ShippingAddress | null = null;

  if (method !== "pickup") {
    Object.assign(
      errors,
      validateDelivery({
        method,
        zip,
        street: text(delivery.street),
        number: text(delivery.number),
        city: text(delivery.city),
        province: text(delivery.province),
        requireShippingOption: false,
      }),
    );
    address = {
      street: text(delivery.street),
      number: text(delivery.number),
      extra: text(delivery.extra),
      city: text(delivery.city),
      province: text(delivery.province),
      zip,
    };
  }

  const payment = resolvePaymentMethod(body.payment?.method, method, { mercadoPago: mercadoPagoReady() });
  const paymentId: PaymentMethodId = payment.ok ? payment.method : "transferencia";
  if (!payment.ok) errors.payment = payment.error;
  const installments = Math.max(1, Math.min(12, Number(body.payment?.installments ?? 1)));

  if (Object.keys(errors).length) {
    return Response.json({ ok: false, errors }, { status: 400 });
  }

  // El cupón se pide temprano y se espera tarde: es independiente de la
  // validación de productos y así las dos consultas viajan juntas.
  const couponCode = text(body.couponCode);
  const couponPromise = couponCode ? getCoupon(couponCode) : null;

  const slugs = items.map((i) => i.slug);
  const rows = await db.select().from(products).where(inArray(products.slug, slugs));
  const bySlug = new Map(rows.map((r) => [r.slug, r]));

  const validated: { slug: string; name: string; image: string; unitPrice: number; quantity: number }[] = [];
  for (const item of items) {
    const product = bySlug.get(item.slug);
    if (!product) {
      return Response.json({ ok: false, error: `El producto ${item.slug} ya no está disponible.` }, { status: 409 });
    }
    // El `stock` migrado es disponibilidad, no cantidad. El tope por producto
    // es MAX_QTY_PER_ITEM; el `stock` solo recorta cuando la cantidad es real
    // (> 1) y menor. El 0 (sin stock) sigue rechazando.
    const wanted = Math.max(1, Math.floor(item.quantity));
    const cap = product.stock > 1 ? Math.min(product.stock, MAX_QTY_PER_ITEM) : product.stock === 0 ? 0 : MAX_QTY_PER_ITEM;
    const quantity = Math.min(wanted, cap);
    if (quantity === 0) {
      return Response.json({ ok: false, error: `Nos quedamos sin stock de ${product.name}.` }, { status: 409 });
    }
    validated.push({
      slug: product.slug,
      name: product.name,
      image: product.images?.[0] ?? "",
      unitPrice: product.price,
      quantity,
    });
  }

  const subtotal = validated.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);

  const coupon = couponPromise ? await couponPromise : null;
  const couponInfo = coupon
    ? {
        code: coupon.code,
        kind: coupon.kind,
        value: coupon.value,
        minSubtotal: coupon.minSubtotal,
        description: coupon.description,
      }
    : null;

  // El precio de Andreani se vuelve a pedir acá con los productos validados:
  // no se confía en el monto que mostró el navegador. La cotización queda en
  // caché unos minutos, así que coincide con lo que vio el cliente.
  const andreani = method === "pickup" ? {} : await preciosAndreani(zip, validated);
  const shippingOption = findShippingOption(method === "pickup" ? "5000" : zip, method, andreani);
  if (!shippingOption) {
    return Response.json({ ok: false, errors: { zip: "No podemos enviar a ese código postal." } }, { status: 400 });
  }

  const totals = computeTotals({
    subtotal,
    coupon: couponInfo,
    shippingCost: shippingOption.cost,
    paymentMethod: paymentId,
    installments,
  });

  // La sucursal se guarda solo si existe en la lista de Andreani para ese CP.
  // Si no se eligió o no se puede verificar, el local la completa desde el panel.
  const branchCode = text(delivery.branch).slice(0, 20);
  if (address && method === "express" && branchCode && andreaniConfigurado()) {
    try {
      const sucursal = (await sucursales(zip)).find((s) => s.codigo === branchCode);
      if (sucursal) {
        address.sucursal = {
          codigo: sucursal.codigo,
          nombre: sucursal.nombre,
          direccion: [sucursal.direccion, sucursal.localidad].filter(Boolean).join(", "),
        };
      }
    } catch (error) {
      console.warn("[andreani] no se pudo verificar la sucursal:", error instanceof AndreaniError ? error.message : "error inesperado");
    }
  }

  const paymentLabel = PAYMENT_METHODS.find((p) => p.id === paymentId)?.label ?? "Transferencia";

  let code = orderCode();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const [existing] = await db.select({ id: orders.id }).from(orders).where(eq(orders.code, code)).limit(1);
    if (!existing) break;
    code = orderCode();
  }

  // Pedido, ítems y stock en una sola transacción: si algo falla, no queda un
  // pedido sin productos ni stock descontado de más.
  await ensureOrderStockSchema();
  const created = await db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        code,
        // Todo pedido nace pendiente, también el de Mercado Pago: el pago se
        // acredita recién cuando el webhook firmado confirma un cobro aprobado.
        status: "pendiente_pago",
        customerName: `${firstName} ${lastName}`,
        email,
        phone,
        docId,
        deliveryMethod: method,
        deliveryLabel: shippingOption.label,
        deliveryEta: shippingOption.eta,
        address,
        paymentMethod: paymentId,
        paymentLabel,
        installments: paymentId === "mercadopago" ? installments : 1,
        subtotal: totals.subtotal,
        discount: totals.couponDiscount,
        paymentAdjustment: totals.paymentAdjustment,
        shippingCost: totals.shippingCost,
        total: totals.total,
        couponCode: couponInfo?.code ?? null,
        notes: text(body.notes).slice(0, 500),
      })
      .returning({ id: orders.id, code: orders.code });

    await tx.insert(orderItems).values(
      validated.map((item) => ({
        orderId: order.id,
        productSlug: item.slug,
        name: item.name,
        image: item.image,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
      })),
    );

    // Descuenta stock solo donde es una cantidad real y anota cuánto, para
    // devolverlo si el pedido se cancela o vence sin pago.
    await reserveOrderStock(tx, order.id);

    // El uso del cupón se cuenta acá, con el tope chequeado en el mismo UPDATE.
    // Si otro pedido se llevó el último uso entre la consulta de arriba y este
    // punto, se deshace todo y el cliente vuelve a intentar sin el cupón.
    if (couponInfo && !(await claimCouponUse(tx, couponInfo.code))) throw new CouponGoneError(couponInfo.code);
    return order;
  }).catch((error: unknown) => {
    if (error instanceof CouponGoneError) return error;
    throw error;
  });

  if (created instanceof CouponGoneError) {
    return Response.json(
      { ok: false, error: `El cupón ${created.code} se acaba de agotar. Sacalo y confirmá el pedido de nuevo.` },
      { status: 409 },
    );
  }

  return Response.json({ ok: true, code: created.code, total: totals.total });
}
