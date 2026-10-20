import { eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { orderEvents, orderItems, orders, products, type Coupon, type ShippingAddress } from "@/db/schema";
import { claimCouponUse, CouponGoneError } from "@/lib/coupons";
import { newOrderCode } from "@/lib/order-code";
import { ensureOrderStockSchema, reserveOrderStock } from "@/lib/order-status";
import { computeTotals, maxQuantityFor, PAYMENT_METHODS, type CouponInfo, type PaymentMethodId, type Totals } from "@/lib/pricing";
import { findShippingOption, type DeliveryMethod, type ShippingOption } from "@/lib/shipping";
import { preciosAndreani } from "@/lib/shipping-andreani";
import type { UsdtRate } from "@/lib/usdt-rate";
import { ensureUsdtSchema } from "@/lib/usdt-schema";
import { createUsdtPayment } from "@/lib/usdt-server";

/**
 * Cómo nace un pedido, igual para el checkout de la tienda y para el pedido
 * cargado desde el panel: los productos, el precio, el stock y el envío salen
 * de la base y de Andreani, nunca de lo que manda el navegador.
 *
 * `priceOrder` arma el pedido (productos, tope de unidades, envío y totales) y
 * `insertOrder` lo guarda en una sola transacción con sus ítems, la reserva de
 * stock, el pago USDT y el uso del cupón. Lo que cambia entre la tienda y el
 * panel (límites por cliente, idempotencia, venta en el mostrador) queda en
 * quien llama.
 */

/** Quién carga el pedido: el cliente en la tienda o alguien del local en el panel. */
export type OrderSource = "web" | "panel";

export type OrderLine = { slug: string; quantity: number };

export type PricedLine = { slug: string; name: string; image: string; unitPrice: number; quantity: number };

export type OrderProblem = { ok: false; status: number; error?: string; errors?: Record<string, string> };

export type PricedOrder = {
  ok: true;
  lines: PricedLine[];
  shipping: ShippingOption;
  coupon: CouponInfo | null;
  totals: Totals;
};

/**
 * Las líneas del carrito como llegan del navegador. El mismo producto en dos
 * líneas se suma, así el tope por producto vale para el total y no para cada línea.
 */
export function mergeOrderLines(raw: unknown): OrderLine[] {
  const merged = new Map<string, number>();
  for (const value of Array.isArray(raw) ? raw : []) {
    const item = value as { slug?: unknown; quantity?: unknown } | null;
    const quantity = Number(item?.quantity);
    if (!item || typeof item.slug !== "string" || !Number.isFinite(quantity) || quantity <= 0) continue;
    merged.set(item.slug, (merged.get(item.slug) ?? 0) + Math.floor(quantity));
  }
  return [...merged].map(([slug, quantity]) => ({ slug, quantity }));
}

function couponInfoOf(coupon: Coupon | null): CouponInfo | null {
  if (!coupon) return null;
  return { code: coupon.code, kind: coupon.kind, value: coupon.value, minSubtotal: coupon.minSubtotal, description: coupon.description };
}

/**
 * Arma el pedido con los datos de la base. En la tienda, una cantidad mayor al
 * tope se recorta (el carrito pudo quedar viejo); en el panel se rechaza, para
 * que quien carga sepa cuántas unidades entran. El cupón se pide junto con los
 * productos: es una consulta independiente y así viajan juntas.
 */
export async function priceOrder(input: {
  source: OrderSource;
  lines: OrderLine[];
  delivery: { method: DeliveryMethod; zip: string };
  paymentMethod: PaymentMethodId;
  installments: number;
  coupon?: Promise<Coupon | null> | null;
}): Promise<PricedOrder | OrderProblem> {
  const web = input.source === "web";
  const [rows, coupon] = await Promise.all([
    db.select().from(products).where(inArray(products.slug, input.lines.map((l) => l.slug))),
    input.coupon ?? null,
  ]);
  const bySlug = new Map(rows.map((r) => [r.slug, r]));

  const lines: PricedLine[] = [];
  for (const line of input.lines) {
    const product = bySlug.get(line.slug);
    if (!product) return { ok: false, status: 409, error: `El producto ${line.slug} ya no está disponible.` };
    const cap = maxQuantityFor(product.stock);
    if (cap === 0) {
      return { ok: false, status: 409, error: web ? `Nos quedamos sin stock de ${product.name}.` : `No hay stock de ${product.name}.` };
    }
    const wanted = Math.max(1, Math.floor(line.quantity));
    if (!web && wanted > cap) {
      return { ok: false, status: 409, error: `De ${product.name} se pueden cargar hasta ${cap} unidades.` };
    }
    lines.push({
      slug: product.slug,
      name: product.name,
      image: product.images?.[0] ?? "",
      unitPrice: product.price,
      quantity: Math.min(wanted, cap),
    });
  }

  // El precio de Andreani se vuelve a pedir acá con los productos validados:
  // no se confía en el monto que mostró el navegador. La cotización queda en
  // caché unos minutos, así que coincide con lo que vio el cliente. Las filas
  // ya leídas van con el pedido: peso y medidas salen de la misma consulta.
  const { method, zip } = input.delivery;
  const andreani = method === "pickup" ? {} : await preciosAndreani(zip, lines, undefined, rows);
  const shipping = findShippingOption(method === "pickup" ? "5000" : zip, method, andreani);
  if (!shipping) {
    return { ok: false, status: 400, errors: { zip: web ? "No podemos enviar a ese código postal." : "No hay envío a ese código postal." } };
  }

  const couponInfo = couponInfoOf(coupon);
  const subtotal = lines.reduce((acc, line) => acc + line.unitPrice * line.quantity, 0);
  const totals = computeTotals({
    subtotal,
    coupon: couponInfo,
    shippingCost: shipping.cost,
    paymentMethod: input.paymentMethod,
    installments: input.installments,
  });
  return { ok: true, lines, shipping, coupon: couponInfo, totals };
}

/** Un código que no use otro pedido (con cuatro reintentos, alcanza de sobra). */
async function freeOrderCode(): Promise<string> {
  let code = newOrderCode();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const [existing] = await db.select({ id: orders.id }).from(orders).where(eq(orders.code, code)).limit(1);
    if (!existing) break;
    code = newOrderCode();
  }
  return code;
}

/**
 * Guarda el pedido. Pedido, ítems, stock, pago USDT y cupón van en una sola
 * transacción: si algo falla, no queda un pedido sin productos ni stock
 * descontado de más. Si otro pedido se llevó el último uso del cupón, se
 * deshace todo y tira `CouponGoneError`; si la `checkoutKey` ya existe, tira el
 * error de unicidad de Postgres (ver `isCheckoutKeyConflict`).
 */
export async function insertOrder(input: {
  priced: PricedOrder;
  status: "pendiente_pago" | "entregado";
  customer: { name: string; email: string; phone: string; docId: string };
  delivery: { method: DeliveryMethod; address: ShippingAddress | null };
  paymentMethod: PaymentMethodId;
  installments: number;
  notes: string;
  checkoutKey?: string | null;
  usdtQuote?: { expectedAmount: string; rate: UsdtRate } | null;
  /** Nota del primer evento del historial; sin nota, el pedido arranca sin eventos. */
  eventNote?: string;
}): Promise<{ id: number; code: string }> {
  const { priced, usdtQuote } = input;
  const { totals } = priced;
  const code = await freeOrderCode();
  const paymentLabel = PAYMENT_METHODS.find((p) => p.id === input.paymentMethod)?.label ?? "Transferencia";

  await ensureOrderStockSchema();
  if (usdtQuote) await ensureUsdtSchema();
  return db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        code,
        status: input.status,
        customerName: input.customer.name,
        email: input.customer.email,
        phone: input.customer.phone,
        docId: input.customer.docId,
        deliveryMethod: input.delivery.method,
        deliveryLabel: priced.shipping.label,
        deliveryEta: priced.shipping.eta,
        address: input.delivery.address,
        paymentMethod: input.paymentMethod,
        paymentLabel,
        installments: input.installments,
        subtotal: totals.subtotal,
        discount: totals.couponDiscount,
        paymentAdjustment: totals.paymentAdjustment,
        shippingCost: totals.shippingCost,
        total: totals.total,
        couponCode: priced.coupon?.code ?? null,
        notes: input.notes,
        checkoutKey: input.checkoutKey ?? null,
      })
      .returning({ id: orders.id, code: orders.code });

    await tx.insert(orderItems).values(
      priced.lines.map((line) => ({
        orderId: order.id,
        productSlug: line.slug,
        name: line.name,
        image: line.image,
        unitPrice: line.unitPrice,
        quantity: line.quantity,
      })),
    );

    // Descuenta stock solo donde es una cantidad real y anota cuánto, para
    // devolverlo si el pedido se cancela o vence sin pago.
    await reserveOrderStock(tx, order.id);
    if (usdtQuote) await createUsdtPayment(tx, order.id, usdtQuote);
    if (input.eventNote) {
      await tx.insert(orderEvents).values({ orderId: order.id, fromStatus: "", toStatus: input.status, note: input.eventNote });
    }

    // El uso del cupón se cuenta acá, con el tope chequeado en el mismo UPDATE.
    // Si otro pedido se llevó el último uso entre la consulta y este punto, se
    // deshace todo y el cliente vuelve a intentar sin el cupón.
    if (priced.coupon && !(await claimCouponUse(tx, priced.coupon.code))) throw new CouponGoneError(priced.coupon.code);
    return order;
  });
}
