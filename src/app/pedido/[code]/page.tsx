import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OrderConfirmation, type OrderSummary } from "@/components/order-confirmation";
import { formatDateTime } from "@/lib/format";
import { getOrderByCode } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Detalle de tu pedido",
  robots: { index: false },
};

type Params = Promise<{ code: string }>;
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
  const result = await getOrderByCode(decodeURIComponent(code)).catch(() => null);

  // Un codigo que no existe tiene que salir con 404, no con 200: la pagina se
  // mostraba bien, pero responder 200 a cualquier `/pedido/lo-que-sea` es el
  // mismo soft-404 que diluye el indice en la ficha de producto. El
  // `not-found.tsx` de esta misma ruta mantiene el mensaje util para el
  // cliente (revisar el codigo, escribirnos) con el status correcto.
  if (!result) notFound();

  const { order, items } = result;
  const summary: OrderSummary = {
    code: order.code,
    status: order.status,
    customerName: order.customerName,
    email: order.email,
    phone: order.phone,
    deliveryMethod: order.deliveryMethod,
    deliveryLabel: order.deliveryLabel,
    deliveryEta: order.deliveryEta,
    address: order.address ?? null,
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

  return <OrderConfirmation order={summary} isNew={isNew} />;
}
