import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { OrderConfirmation, type OrderSummary } from "@/components/order-confirmation";
import { formatDateTime } from "@/lib/format";
import { getOrderByCode } from "@/lib/queries";
import { blockedMinutes, ipFromHeaders, ORDER_LOOKUP_LIMIT, recordMiss } from "@/lib/rate-limit";
import { transferAccount } from "@/lib/transfer-account";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Detalle de tu pedido",
  robots: { index: false },
};

type Params = Promise<{ code: string }>;

const ADDRESS_VISIBLE_MS = 24 * 60 * 60 * 1000;

/** `ronan@gmail.com` → `ro•••@gmail.com`. */
function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at < 1) return "•••";
  return `${email.slice(0, Math.min(2, at))}•••${email.slice(at)}`;
}

function createdWithin(createdAt: Date | string, ms: number): boolean {
  return Date.now() - new Date(createdAt).getTime() < ms;
}

/** Solo los últimos 3 dígitos. */
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length > 3 ? `•••${digits.slice(-3)}` : "•••";
}
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { code } = await params;
  const query = await searchParams;
  // Mismo límite que "Seguir pedido": quien prueba códigos al azar se frena.
  const ip = ipFromHeaders(await headers());
  if (await blockedMinutes(ORDER_LOOKUP_LIMIT, ip).catch(() => 0)) notFound();
  const result = await getOrderByCode(decodeURIComponent(code)).catch(() => null);
  if (!result) await recordMiss(ORDER_LOOKUP_LIMIT, ip).catch(() => undefined);

  // Un codigo que no existe tiene que salir con 404, no con 200: la pagina se
  // mostraba bien, pero responder 200 a cualquier `/pedido/lo-que-sea` es el
  // mismo soft-404 que diluye el indice en la ficha de producto. El
  // `not-found.tsx` de esta misma ruta mantiene el mensaje util para el
  // cliente (revisar el codigo, escribirnos) con el status correcto.
  if (!result) notFound();

  const { order, items } = result;
  // Esta página se abre con solo el código (es adonde vuelve Mercado Pago), así
  // que no muestra datos personales completos: el email y el teléfono van
  // enmascarados, y la calle y el número solo durante el primer día, que es
  // cuando el cliente los revisa.
  const recent = createdWithin(order.createdAt, ADDRESS_VISIBLE_MS);
  const address = order.address
    ? recent
      ? order.address
      : { ...order.address, street: "", number: "", extra: "" }
    : null;
  const summary: OrderSummary = {
    code: order.code,
    status: order.status,
    customerName: order.customerName,
    email: maskEmail(order.email),
    phone: maskPhone(order.phone),
    deliveryMethod: order.deliveryMethod,
    deliveryLabel: order.deliveryLabel,
    deliveryEta: order.deliveryEta,
    trackingCode: order.trackingCode ?? "",
    address,
    paymentMethod: order.paymentMethod,
    paymentLabel: order.paymentLabel,
    installments: order.installments,
    subtotal: order.subtotal,
    discount: order.discount,
    paymentAdjustment: order.paymentAdjustment,
    shippingCost: order.shippingCost,
    total: order.total,
    couponCode: order.couponCode,
    notes: order.notes,
    createdAt: formatDateTime(order.createdAt),
    items: items.map((item) => ({
      name: item.name,
      image: item.image,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      productSlug: item.productSlug,
    })),
  };

  const isNew = query.nuevo === "1";

  const pago = typeof query.pago === "string" ? query.pago : undefined;

  return <OrderConfirmation order={summary} isNew={isNew} paymentReturn={pago} transfer={transferAccount()} />;
}
