import { and, eq, gt, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { orders, type ShippingAddress } from "@/db/schema";
import type { PaymentMethodId } from "@/lib/pricing";
import { releaseStaleStockHolds } from "@/lib/order-status";
import { applyDuePriceSchedules } from "@/lib/price-schedules";
import { refreshStorePages } from "@/lib/store-cache";
import { PENDING_EXPIRY_HOURS } from "@/lib/payment-rules";
import { CouponGoneError, getCoupon } from "@/lib/coupons";
import { insertOrder, mergeOrderLines, priceOrder } from "@/lib/checkout-order";
import { resolvePaymentMethod } from "@/lib/checkout-payment";
import { mercadoPagoReady } from "@/lib/mercadopago";
import { validateDelivery, validatePersonalData } from "@/lib/checkout-validation";
import { normalizeZip, type DeliveryMethod } from "@/lib/shipping";
import { andreaniConfigurado, AndreaniError, sucursales } from "@/lib/andreani";
import { findOrderByCheckoutKey, isCheckoutKeyConflict, parseCheckoutKey } from "@/lib/checkout-idempotency";
import { blockedMinutes, CHECKOUT_LIMIT, COUPON_LIMIT, ipFromHeaders, recordMiss, tooManyAttempts } from "@/lib/rate-limit";
import { usdtAmountFor } from "@/lib/usdt-amount";
import { getUsdtRate, type UsdtRate } from "@/lib/usdt-rate";
import { getUsdtWallet } from "@/lib/usdt-server";

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

  const items = mergeOrderLines(body.items);
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

  // Las dos lecturas no dependen una de otra: van juntas a la base.
  const checkoutKey = parseCheckoutKey(body.checkoutKey);
  const [existing, unpaid] = await Promise.all([
    checkoutKey ? findOrderByCheckoutKey(checkoutKey, email) : null,
    countUnpaidOrders(email, phone),
  ]);

  // El mismo intento ya creó un pedido (la respuesta se perdió o llegó un
  // doble toque): se devuelve ese, sin reservar stock ni usar el cupón de nuevo.
  if (existing) return Response.json({ ok: true, code: existing.code, total: existing.total });

  // Sin pago no hay reserva, pero una orden igual guarda stock un rato: con
  // un tope por cliente, nadie puede llenar la tienda de órdenes que no paga.
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
  // Ofertas programadas: el precio que se cobra es el de esta hora, aunque
  // nadie haya pasado por la tienda desde que empezó o terminó la oferta.
  await applyDuePriceSchedules()
    .then(({ changed }) => changed.length && refreshStorePages(changed))
    .catch((error) => console.error("[checkout] no se pudieron aplicar las ofertas programadas:", error));

  // Un cupón que no existe se ignora (el pedido sale sin descuento), pero
  // cuenta como intento fallido igual que en /api/coupon: si no, el total que
  // devuelve el checkout serviría para adivinar códigos a fuerza bruta.
  const couponCode = text(body.couponCode).slice(0, 40);
  if (couponCode) {
    const couponBlocked = await blockedMinutes(COUPON_LIMIT, ip);
    if (couponBlocked) return tooManyAttempts(couponBlocked);
  }
  const coupon = couponCode
    ? getCoupon(couponCode).then(async (found) => {
        if (!found) await recordMiss(COUPON_LIMIT, ip);
        return found;
      })
    : null;

  const priced = await priceOrder({ source: "web", lines: items, delivery: { method, zip }, paymentMethod: paymentId, installments, coupon });
  if (!priced.ok) {
    return Response.json(priced.errors ? { ok: false, errors: priced.errors } : { ok: false, error: priced.error }, { status: priced.status });
  }
  const { totals } = priced;

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

  const created = await insertOrder({
    priced,
    // Todo pedido nace pendiente, también el de Mercado Pago: el pago se
    // acredita recién cuando el webhook firmado confirma un cobro aprobado.
    status: "pendiente_pago",
    customer: { name: `${firstName} ${lastName}`, email, phone, docId },
    delivery: { method, address },
    paymentMethod: paymentId,
    installments: paymentId === "mercadopago" ? installments : 1,
    notes: text(body.notes).slice(0, 500),
    checkoutKey,
    usdtQuote,
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
