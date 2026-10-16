import { eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { orderEvents, orderItems, orders, products, type ShippingAddress } from "@/db/schema";
import { resolvePaymentMethod } from "@/lib/checkout-payment";
import { validateDelivery, validatePersonalData } from "@/lib/checkout-validation";
import { mercadoPagoReady } from "@/lib/mercadopago";
import { newOrderCode } from "@/lib/order-code";
import { ensureOrderStockSchema, reserveOrderStock } from "@/lib/order-status";
import { computeTotals, MAX_QTY_PER_ITEM, PAYMENT_METHODS, type PaymentMethodId } from "@/lib/pricing";
import { findShippingOption, normalizeZip, type DeliveryMethod } from "@/lib/shipping";
import { preciosAndreani } from "@/lib/shipping-andreani";

/**
 * Pedido cargado desde el panel (ventas por WhatsApp, teléfono o mostrador).
 *
 * Sigue las mismas reglas que el checkout de la tienda: el precio, el stock y
 * el envío salen de la base y de Andreani, nunca de lo que manda el navegador,
 * y el pedido nace "pendiente de pago" con el stock reservado. El cliente paga
 * desde la página del pedido (`/pedido/CODIGO`) con el medio elegido, así el
 * cobro y la acreditación son los de siempre. Lo único distinto: no lleva
 * cupón ni límite de intentos (lo carga alguien con sesión del panel).
 */

export type ManualOrderInput = {
  items?: unknown;
  customer?: { firstName?: unknown; lastName?: unknown; email?: unknown; phone?: unknown; docId?: unknown };
  delivery?: { method?: unknown; zip?: unknown; street?: unknown; number?: unknown; extra?: unknown; city?: unknown; province?: unknown };
  payment?: { method?: unknown };
  notes?: unknown;
};

export type ManualOrderResult =
  | { ok: true; code: string; total: number }
  | { ok: false; status: number; error?: string; errors?: Record<string, string> };

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function createManualOrder(input: ManualOrderInput): Promise<ManualOrderResult> {
  // El mismo producto en dos líneas se suma antes de aplicar el tope.
  const merged = new Map<string, number>();
  for (const raw of Array.isArray(input.items) ? input.items : []) {
    const item = raw as { slug?: unknown; quantity?: unknown } | null;
    const quantity = Number(item?.quantity);
    if (!item || typeof item.slug !== "string" || !Number.isFinite(quantity) || quantity <= 0) continue;
    merged.set(item.slug, (merged.get(item.slug) ?? 0) + Math.floor(quantity));
  }
  const items = [...merged].map(([slug, quantity]) => ({ slug, quantity }));
  if (!items.length) return { ok: false, status: 400, error: "Agregá al menos un producto." };

  const customer = input.customer ?? {};
  const firstName = text(customer.firstName);
  const lastName = text(customer.lastName);
  const email = text(customer.email).toLowerCase();
  const phone = text(customer.phone);
  const docId = text(customer.docId);
  const errors: Record<string, string> = { ...validatePersonalData({ firstName, lastName, email, phone, docId }) };

  const delivery = input.delivery ?? {};
  const method: DeliveryMethod = delivery.method === "standard" || delivery.method === "express" ? delivery.method : "pickup";
  const zip = normalizeZip(text(delivery.zip));
  let address: ShippingAddress | null = null;
  if (method !== "pickup") {
    const fields = {
      street: text(delivery.street),
      number: text(delivery.number),
      city: text(delivery.city),
      province: text(delivery.province),
    };
    Object.assign(errors, validateDelivery({ method, zip, ...fields, requireShippingOption: false }));
    address = { ...fields, extra: text(delivery.extra), zip };
  }

  const payment = resolvePaymentMethod(input.payment?.method, method, { mercadoPago: mercadoPagoReady() });
  if (!payment.ok) errors.payment = payment.error;
  if (Object.keys(errors).length || !payment.ok) return { ok: false, status: 400, errors };
  const paymentId: PaymentMethodId = payment.method;

  const rows = await db.select().from(products).where(inArray(products.slug, items.map((i) => i.slug)));
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  const validated: { slug: string; name: string; image: string; unitPrice: number; quantity: number }[] = [];
  for (const item of items) {
    const product = bySlug.get(item.slug);
    if (!product) return { ok: false, status: 409, error: `El producto ${item.slug} ya no está disponible.` };
    // Mismo tope que el checkout: el stock 1 migrado es "hay", no una cantidad.
    const cap = product.stock > 1 ? Math.min(product.stock, MAX_QTY_PER_ITEM) : product.stock === 0 ? 0 : MAX_QTY_PER_ITEM;
    if (cap === 0) return { ok: false, status: 409, error: `No hay stock de ${product.name}.` };
    if (item.quantity > cap) {
      return { ok: false, status: 409, error: `De ${product.name} se pueden cargar hasta ${cap} unidades.` };
    }
    validated.push({ slug: product.slug, name: product.name, image: product.images?.[0] ?? "", unitPrice: product.price, quantity: item.quantity });
  }

  const andreani = method === "pickup" ? {} : await preciosAndreani(zip, validated);
  const shippingOption = findShippingOption(method === "pickup" ? "5000" : zip, method, andreani);
  if (!shippingOption) return { ok: false, status: 400, errors: { zip: "No hay envío a ese código postal." } };

  const subtotal = validated.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
  const totals = computeTotals({ subtotal, coupon: null, shippingCost: shippingOption.cost, paymentMethod: paymentId, installments: 1 });
  const paymentLabel = PAYMENT_METHODS.find((p) => p.id === paymentId)?.label ?? "Transferencia";

  let code = newOrderCode();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const [existing] = await db.select({ id: orders.id }).from(orders).where(eq(orders.code, code)).limit(1);
    if (!existing) break;
    code = newOrderCode();
  }

  await ensureOrderStockSchema();
  const created = await db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        code,
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
        installments: 1,
        subtotal: totals.subtotal,
        discount: totals.couponDiscount,
        paymentAdjustment: totals.paymentAdjustment,
        shippingCost: totals.shippingCost,
        total: totals.total,
        couponCode: null,
        notes: text(input.notes).slice(0, 500),
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
    await reserveOrderStock(tx, order.id);
    await tx.insert(orderEvents).values({ orderId: order.id, fromStatus: "", toStatus: "pendiente_pago", note: "Pedido cargado desde el panel" });
    return order;
  });

  return { ok: true, code: created.code, total: totals.total };
}
