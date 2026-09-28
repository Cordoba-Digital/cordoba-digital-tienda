import type { Metadata } from "next";
import Link from "next/link";

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

  if (!result) {
    return (
      <div className="container-xl py-16">
        <div className="card-surface mx-auto flex max-w-lg flex-col items-center gap-3 px-8 py-14 text-center">
          <span className="text-5xl">🔎</span>
          <h1 className="text-xl font-extrabold text-ink-900">No encontramos ese pedido</h1>
          <p className="text-sm text-ink-500">
            Revisá el código (tiene el formato CD-XXXXXX) o escribinos por WhatsApp y lo buscamos por vos.
          </p>
          <div className="mt-2 flex gap-3">
            <Link href="/seguimiento" className="rounded-xl bg-ink-900 px-5 py-3 text-sm font-bold text-white">
              Buscar mi pedido
            </Link>
            <a
              href="https://wa.me/5493516777774"
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-ink-200 px-5 py-3 text-sm font-bold text-ink-700"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </div>
    );
  }

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
