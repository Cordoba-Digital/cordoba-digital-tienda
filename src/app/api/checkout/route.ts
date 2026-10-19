import { and, eq, gt, inArray, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { orderItems, orders, products, type ShippingAddress } from "@/db/schema";
import { computeTotals, MAX_QTY_PER_ITEM, PAYMENT_METHODS, type PaymentMethodId } from "@/lib/pricing";
import { ensureOrderStockSchema, PENDING_EXPIRY_HOURS, releaseStaleStockHolds, reserveOrderStock } from "@/lib/order-status";
import { claimCouponUse, CouponGoneError, getCoupon } from "@/lib/coupons";
import { resolvePaymentMethod } from "@/lib/checkout-payment";
import { mercadoPagoReady } from "@/lib/mercadopago";
import { validateDelivery, validatePersonalData } from "@/lib/checkout-validation";
import { findShippingOption, normalizeZip, type DeliveryMethod } from "@/lib/shipping";
import { preciosAndreani } from "@/lib/shipping-andreani";
import { andreaniConfigurado, AndreaniError, sucursales } from "@/lib/andreani";
import { findOrderByCheckoutKey, isCheckoutKeyConflict, parseCheckoutKey } from "@/lib/checkout-idempotency";
import { blockedMinutes, CHECKOUT_LIMIT, COUPON_LIMIT, ipFromHeaders, recordMiss, tooManyAttempts } from "@/lib/rate-limit";
import { usdtAmountFor } from "@/lib/usdt-amount";
import { getUsdtRate, type UsdtRate } from "@/lib/usdt-rate";
import { ensureUsdtSchema } from "@/lib/usdt-schema";
import { createUsdtPayment, getUsdtWallet } from "@/lib/usdt-server";

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
  /** Clave del intento de compra (ver `checkout-idempotency.ts`). */
  checkoutKey?: string;
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

/** Órdenes sin pago que puede tener abiertas un mismo email o teléfono. */
const MAX_UNPAID_ORDERS = 2;

async function countUnpaidOrders(email: string, phone: string): Promise<number> {
  // Los últimos 8 dígitos: el mismo celular con o sin +54, 9 o 0.
  const phoneTail = phone.replace(/\D/g, "").slice(-8);
  const since = new Date(Date.now() - PENDING_EXPIRY_HOURS * 60 * 60 * 1000);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(
      and(
        eq(orders.status, "pendiente_pago"),
        gt(orders.createdAt, since),
        or(
          eq(orders.email, email),
          phoneTail.length === 8 ? sql`right(regexp_replace(${orders.phone}, '\\D', '', 'g'), 8) = ${phoneTail}` : undefined,
        ),
      ),
    );
  return row?.count ?? 0;
}

export async function POST(request: Request) {
  const ip = ipFromHeaders(request.headers);
  const blocked = await blockedMinutes(CHECKOUT_LIMIT, ip);
  if (blocked) return tooManyAttempts(blocked);

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

  const payment = resolvePaymentMethod(body.payment?.method, method, {
    mercadoPago: mercadoPagoReady(),
    usdt: body.payment?.method === "usdt" && !!(await getUsdtWallet()),
  });
  const paymentId: PaymentMethodId = payment.ok ? payment.method : "transferencia";
  if (!payment.ok) errors.payment = payment.error;
  const installments = Math.max(1, Math.min(12, Number(body.payment?.installments ?? 1)));

  if (Object.keys(errors).length) {
    return Response.json({ ok: false, errors }, { status: 400 });
  }

  // El mismo intento ya creó un pedido (la respuesta se perdió o llegó un
  // doble toque): se devuelve ese, sin reservar stock ni usar el cupón de nuevo.
  const checkoutKey = parseCheckoutKey(body.checkoutKey);
  if (checkoutKey) {
    const existing = await findOrderByCheckoutKey(checkoutKey, email);
    if (existing) return Response.json({ ok: true, code: existing.code, total: existing.total });
  }

  // Sin pago no hay reserva, pero una orden igual guarda stock un rato: con
  // un tope por cliente, nadie puede llenar la tienda de órdenes que no paga.
  const unpaid = await countUnpaidOrders(email, phone);
  if (unpaid >= MAX_UNPAID_ORDERS) {
    return Response.json(
      {
        ok: false,
        error: `Ya tenés ${unpaid} órdenes esperando el pago. Pagá alguna o esperá a que venza para hacer otra; si necesitás ayuda, escribinos por WhatsApp.`,
      },
      { status: 429 },
    );
  }
  // El stock de las órdenes que no se pagaron en 2 hs vuelve a la venta antes
  // de mirar si alcanza. Si falla, se compra igual con el stock como está.
  await releaseStaleStockHolds().catch((error) => console.error("[checkout] no se pudo liberar stock vencido:", error));

  // El cupón se pide temprano y se espera tarde: es independiente de la
  // validación de productos y así las dos consultas viajan juntas.
  // Un cupón que no existe se ignora (el pedido sale sin descuento), pero
  // cuenta como intento fallido igual que en /api/coupon: si no, el total que
  // devuelve el checkout serviría para adivinar códigos a fuerza bruta.
  const couponCode = text(body.couponCode).slice(0, 40);
  if (couponCode) {
    const couponBlocked = await blockedMinutes(COUPON_LIMIT, ip);
    if (couponBlocked) return tooManyAttempts(couponBlocked);
  }
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
  if (couponCode && !coupon) await recordMiss(COUPON_LIMIT, ip);
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

  // USDT: el monto exacto sale del total con la cotización que cargó la tienda
  // y queda fijo en el pedido. Sin cotización no se puede cobrar en USDT.
  let usdtQuote: { expectedAmount: string; rate: UsdtRate } | null = null;
  if (paymentId === "usdt") {
    const rate = await getUsdtRate();
    if (!rate) {
      return Response.json(
        { ok: false, errors: { payment: "El pago con USDT no está disponible ahora. Elegí otro medio de pago." } },
        { status: 400 },
      );
    }
    usdtQuote = { expectedAmount: usdtAmountFor(totals.total, rate.rate), rate };
  }

  let code = orderCode();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const [existing] = await db.select({ id: orders.id }).from(orders).where(eq(orders.code, code)).limit(1);
    if (!existing) break;
    code = orderCode();
  }

  // Pedido, ítems y stock en una sola transacción: si algo falla, no queda un
  // pedido sin productos ni stock descontado de más.
  await ensureOrderStockSchema();
  if (usdtQuote) await ensureUsdtSchema();
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
        checkoutKey,
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
    if (usdtQuote) await createUsdtPayment(tx, order.id, usdtQuote);

    // El uso del cupón se cuenta acá, con el tope chequeado en el mismo UPDATE.
    // Si otro pedido se llevó el último uso entre la consulta de arriba y este
    // punto, se deshace todo y el cliente vuelve a intentar sin el cupón.
    if (couponInfo && !(await claimCouponUse(tx, couponInfo.code))) throw new CouponGoneError(couponInfo.code);
    return order;
  }).catch((error: unknown) => {
    if (error instanceof CouponGoneError) return error;
    // Dos envíos con la misma clave llegaron juntos y el otro guardó primero:
    // esta transacción se deshizo entera y se responde con el pedido del otro.
    if (checkoutKey && isCheckoutKeyConflict(error)) return null;
    throw error;
  });

  if (created === null) {
    const existing = checkoutKey ? await findOrderByCheckoutKey(checkoutKey, email) : null;
    // La clave es de un pedido con otro email: no se muestra, se pide reintentar.
    if (!existing) {
      return Response.json({ ok: false, error: "No pudimos procesar el pedido. Probá de nuevo." }, { status: 409 });
    }
    return Response.json({ ok: true, code: existing.code, total: existing.total });
  }

  if (created instanceof CouponGoneError) {
    return Response.json(
      { ok: false, error: `El cupón ${created.code} se acaba de agotar. Sacalo y confirmá el pedido de nuevo.` },
      { status: 409 },
    );
  }

  await recordMiss(CHECKOUT_LIMIT, ip);
  return Response.json({ ok: true, code: created.code, total: totals.total });
}
