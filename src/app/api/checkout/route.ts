import { eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { orderItems, orders, products, type ShippingAddress } from "@/db/schema";
import { computeTotals, PAYMENT_METHODS, type PaymentMethodId } from "@/lib/pricing";
import { getCoupon } from "@/lib/queries";
import { findShippingOption, normalizeZip, type DeliveryMethod } from "@/lib/shipping";

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
  };
  payment?: { method?: PaymentMethodId; installments?: number };
  couponCode?: string | null;
  notes?: string;
};

function orderCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `CD-${suffix}`;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as CheckoutBody;
  const errors: Record<string, string> = {};

  const items = (body.items ?? []).filter((i) => i && typeof i.slug === "string" && i.quantity > 0);
  if (!items.length) {
    return Response.json({ ok: false, error: "Tu carrito está vacío." }, { status: 400 });
  }

  const customer = body.customer ?? {};
  const firstName = (customer.firstName ?? "").trim();
  const lastName = (customer.lastName ?? "").trim();
  const email = (customer.email ?? "").trim().toLowerCase();
  const phone = (customer.phone ?? "").trim();
  const docId = (customer.docId ?? "").trim();

  if (firstName.length < 2) errors.firstName = "Ingresá tu nombre.";
  if (lastName.length < 2) errors.lastName = "Ingresá tu apellido.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = "Ingresá un email válido.";
  if (phone.replace(/\D/g, "").length < 8) errors.phone = "Ingresá un teléfono de contacto.";
  if (docId.replace(/\D/g, "").length < 7) errors.docId = "Ingresá tu DNI o CUIT para la factura.";

  const delivery = body.delivery ?? {};
  const method: DeliveryMethod = delivery.method === "pickup" || delivery.method === "express" ? delivery.method : "standard";
  const zip = normalizeZip(delivery.zip ?? "");
  let address: ShippingAddress | null = null;

  if (method !== "pickup") {
    if (zip.length !== 4) errors.zip = "Ingresá un código postal válido.";
    if ((delivery.street ?? "").trim().length < 3) errors.street = "Ingresá la calle.";
    if ((delivery.number ?? "").trim().length < 1) errors.number = "Ingresá la altura.";
    if ((delivery.city ?? "").trim().length < 2) errors.city = "Ingresá la localidad.";
    if ((delivery.province ?? "").trim().length < 2) errors.province = "Elegí la provincia.";
    address = {
      street: (delivery.street ?? "").trim(),
      number: (delivery.number ?? "").trim(),
      extra: (delivery.extra ?? "").trim(),
      city: (delivery.city ?? "").trim(),
      province: (delivery.province ?? "").trim(),
      zip,
    };
  }

  const paymentId: PaymentMethodId = (["transferencia", "usdt", "efectivo", "mercadopago"] as const).includes(
    body.payment?.method as PaymentMethodId,
  )
    ? (body.payment?.method as PaymentMethodId)
    : "transferencia";
  const installments = Math.max(1, Math.min(12, Number(body.payment?.installments ?? 1)));

  if (paymentId === "efectivo" && method !== "pickup") {
    errors.payment = "El pago en efectivo solo está disponible retirando en el local.";
  }

  if (Object.keys(errors).length) {
    return Response.json({ ok: false, errors }, { status: 400 });
  }

  const slugs = items.map((i) => i.slug);
  const rows = await db.select().from(products).where(inArray(products.slug, slugs));
  const bySlug = new Map(rows.map((r) => [r.slug, r]));

  const validated: { slug: string; name: string; image: string; unitPrice: number; quantity: number }[] = [];
  for (const item of items) {
    const product = bySlug.get(item.slug);
    if (!product) {
      return Response.json({ ok: false, error: `El producto ${item.slug} ya no está disponible.` }, { status: 409 });
    }
    const quantity = Math.min(Math.max(1, Math.floor(item.quantity)), Math.max(0, product.stock));
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

  const coupon = body.couponCode ? await getCoupon(body.couponCode) : null;
  const couponInfo = coupon
    ? {
        code: coupon.code,
        kind: coupon.kind,
        value: coupon.value,
        minSubtotal: coupon.minSubtotal,
        description: coupon.description,
      }
    : null;

  const shippingOption = findShippingOption(method === "pickup" ? "5000" : zip, method);
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

  const paymentLabel = PAYMENT_METHODS.find((p) => p.id === paymentId)?.label ?? "Transferencia";

  let code = orderCode();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const [existing] = await db.select({ id: orders.id }).from(orders).where(eq(orders.code, code)).limit(1);
    if (!existing) break;
    code = orderCode();
  }

  const [created] = await db
    .insert(orders)
    .values({
      code,
      // Mercado Pago cobra en línea, así que el pago ya está acreditado. Los
      // demás quedan pendientes hasta que el buyer transfiera o pague en el local.
      status: paymentId === "mercadopago" ? "pago_confirmado" : "pendiente_pago",
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
      notes: (body.notes ?? "").trim().slice(0, 500),
    })
    .returning({ id: orders.id, code: orders.code });

  await db.insert(orderItems).values(
    validated.map((item) => ({
      orderId: created.id,
      productSlug: item.slug,
      name: item.name,
      image: item.image,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
    })),
  );

  await Promise.all(
    validated.map((item) =>
      db
        .update(products)
        .set({
          // OJO: el catálogo migrado guarda `stock` como disponibilidad
          // (1 = hay stock, 0 = no hay) porque la API pública de WooCommerce no
          // expone cantidades. Si descontáramos siempre, la primera venta dejaría
          // el producto agotado para siempre. Solo bajamos el stock cuando
          // representa una cantidad real (> 1), que es lo que tendremos cuando
          // el cliente pase las claves de WooCommerce.
          stock: sql`case when ${products.stock} > 1 then greatest(${products.stock} - ${item.quantity}, 0) else ${products.stock} end`,
          soldCount: sql`${products.soldCount} + ${item.quantity}`,
        })
        .where(eq(products.slug, item.slug)),
    ),
  );

  return Response.json({ ok: true, code: created.code, total: totals.total });
}
