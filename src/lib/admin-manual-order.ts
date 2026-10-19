import type { ShippingAddress } from "@/db/schema";
import { insertOrder, mergeOrderLines, priceOrder } from "@/lib/checkout-order";
import { resolvePaymentMethod } from "@/lib/checkout-payment";
import { validateDelivery, validatePersonalData } from "@/lib/checkout-validation";
import { mercadoPagoReady } from "@/lib/mercadopago";
import type { PaymentMethodId } from "@/lib/pricing";
import { normalizeZip, type DeliveryMethod } from "@/lib/shipping";

/**
 * Pedido cargado desde el panel (ventas por WhatsApp, teléfono o mostrador).
 *
 * Nace por el mismo camino que el checkout de la tienda (`checkout-order.ts`):
 * el precio, el stock y el envío salen de la base y de Andreani, nunca de lo
 * que manda el navegador, y el pedido nace "pendiente de pago" con el stock reservado. El cliente paga
 * desde la página del pedido (`/pedido/CODIGO`) con el medio elegido, así el
 * cobro y la acreditación son los de siempre. Lo único distinto: no lleva
 * cupón ni límite de intentos (lo carga alguien con sesión del panel).
 *
 * Venta en el local (`counterSale`): el cliente ya pagó en el mostrador y se
 * llevó el producto. Solo con retiro y efectivo o transferencia; el pedido
 * nace "Entregado" (cuenta como venta pagada), el stock baja igual y del
 * cliente alcanza con nombre y apellido.
 */

export type ManualOrderInput = {
  items?: unknown;
  customer?: { firstName?: unknown; lastName?: unknown; email?: unknown; phone?: unknown; docId?: unknown };
  delivery?: { method?: unknown; zip?: unknown; street?: unknown; number?: unknown; extra?: unknown; city?: unknown; province?: unknown };
  payment?: { method?: unknown };
  notes?: unknown;
  counterSale?: unknown;
};

export type ManualOrderResult =
  | { ok: true; code: string; total: number; delivered: boolean }
  | { ok: false; status: number; error?: string; errors?: Record<string, string> };

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function createManualOrder(input: ManualOrderInput): Promise<ManualOrderResult> {
  const items = mergeOrderLines(input.items);
  if (!items.length) return { ok: false, status: 400, error: "Agregá al menos un producto." };

  const customer = input.customer ?? {};
  const firstName = text(customer.firstName);
  const lastName = text(customer.lastName);
  const email = text(customer.email).toLowerCase();
  const phone = text(customer.phone);
  const docId = text(customer.docId);
  const delivery = input.delivery ?? {};
  const method: DeliveryMethod = delivery.method === "standard" || delivery.method === "express" ? delivery.method : "pickup";
  const counterSale = input.counterSale === true;

  const errors: Record<string, string> = { ...validatePersonalData({ firstName, lastName, email, phone, docId }) };
  // En el mostrador, email, celular y DNI son opcionales; si se cargan, tienen que estar bien.
  if (counterSale) {
    if (!email) delete errors.email;
    if (!phone) delete errors.phone;
    if (!docId) delete errors.docId;
  }
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

  const payment = resolvePaymentMethod(input.payment?.method, method, { mercadoPago: mercadoPagoReady(), manual: true });
  if (!payment.ok) errors.payment = payment.error;
  if (Object.keys(errors).length || !payment.ok) return { ok: false, status: 400, errors };
  const paymentId: PaymentMethodId = payment.method;
  if (counterSale && (method !== "pickup" || paymentId === "mercadopago")) {
    return { ok: false, status: 400, error: "La venta en el local es con retiro y pago en efectivo o transferencia." };
  }
  const status = counterSale ? "entregado" : "pendiente_pago";

  const priced = await priceOrder({ source: "panel", lines: items, delivery: { method, zip }, paymentMethod: paymentId, installments: 1 });
  if (!priced.ok) return priced;

  const created = await insertOrder({
    priced,
    status,
    customer: { name: `${firstName} ${lastName}`, email, phone, docId },
    delivery: { method, address },
    paymentMethod: paymentId,
    installments: 1,
    notes: text(input.notes).slice(0, 500),
    eventNote: counterSale ? "Venta en el local: cobrada y entregada" : "Pedido cargado desde el panel",
  });

  return { ok: true, code: created.code, total: priced.totals.total, delivered: counterSale };
}
