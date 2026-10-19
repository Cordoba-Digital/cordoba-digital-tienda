import { eq } from "drizzle-orm";

import { db } from "@/db";
import { orderEvents, orders } from "@/db/schema";
import { isAutomationOn } from "@/lib/automations";
import { money } from "@/lib/format";
import { amountDueAtPickup, amountDueOnline, PICKUP_HOURS } from "@/lib/payment-rules";
import { mailConfigured, sendMail, STORE_EMAIL } from "@/lib/mailer";
import { url } from "@/lib/site";

type OrderForEmail = Pick<
  typeof orders.$inferSelect,
  "code" | "customerName" | "email" | "deliveryMethod" | "total" | "trackingCode"
> & { paymentMethod?: string };

/**
 * El email que recibe el cliente cuando su pedido pasa a `status`, o null si
 * ese estado no avisa ("Esperando el pago" ya tiene su página de confirmación).
 * `note` es la nota del cambio: distingue un pedido vencido de uno cancelado a mano.
 */
export function orderStatusEmail(
  order: OrderForEmail,
  status: string,
  note = "",
): { subject: string; text: string } | null {
  const firstName = order.customerName.trim().split(/\s+/)[0] || "";
  const hello = firstName ? `Hola ${firstName},` : "Hola,";
  const pickup = order.deliveryMethod === "pickup";
  let subject: string;
  let body: string;

  switch (status) {
    case "pago_confirmado":
      if (order.paymentMethod === "sena") {
        const deposit = amountDueOnline({ paymentMethod: "sena", total: order.total });
        const rest = amountDueAtPickup({ paymentMethod: "sena", total: order.total });
        subject = `Reserva confirmada: ${order.code}`;
        body = `Recibimos la seña de ${money(deposit)}. Tu código de reserva es ${order.code}. ${
          rest > 0 ? `El resto, ${money(rest)}, lo pagás al retirar en el local.` : "No queda saldo por pagar."
        } Tenés ${PICKUP_HOURS} horas para retirarlo; si no pasás, la reserva vence. Te avisamos cuando esté listo.`;
        break;
      }
      subject = `Recibimos el pago de tu pedido ${order.code}`;
      body = `Ya se acreditó el pago de tu pedido ${order.code} por ${money(order.total)}. Ahora lo preparamos y te avisamos cuando esté ${pickup ? "listo para retirar" : "en camino"}.`;
      break;
    case "preparando":
      subject = `Estamos preparando tu pedido ${order.code}`;
      body = `Estamos controlando y embalando los productos de tu pedido ${order.code}. Te avisamos cuando esté ${pickup ? "listo para retirar" : "en camino"}.`;
      break;
    case "enviado":
      if (pickup) {
        subject = `Tu pedido ${order.code} está listo para retirar`;
        body = `Tu pedido ${order.code} ya está listo. Podés pasar a retirarlo por el local con tu DNI y el número de pedido.`;
      } else {
        subject = `Tu pedido ${order.code} está en camino`;
        body = order.trackingCode
          ? `Despachamos tu pedido ${order.code}. El código de seguimiento es ${order.trackingCode}.`
          : `Despachamos tu pedido ${order.code}. En cuanto tengamos el código de seguimiento lo vas a ver en la página del pedido.`;
      }
      break;
    case "entregado":
      subject = `Tu pedido ${order.code} fue entregado`;
      body = `¡Gracias por tu compra! La garantía de tus productos ya está activa. Si tenés cualquier problema, respondé este email.`;
      break;
    case "cancelado":
      subject = `Cancelamos tu pedido ${order.code}`;
      body = note.startsWith("Reserva vencida")
        ? `Venció tu reserva ${order.code}: pasaron ${PICKUP_HOURS} horas desde la seña y no la retiraste, así que el producto volvió a la venta. Respondé este email y vemos cómo seguimos con tu seña.`
        : note.startsWith("Vencido")
        ? `No recibimos el pago de tu orden ${order.code} ${expiredWithin(note)}, así que la cancelamos. Si todavía querés los productos, podés hacer un pedido nuevo en la tienda.`
        : `Cancelamos tu pedido ${order.code}. Si no esperabas este cambio o tenés alguna duda, respondé este email y lo vemos.`;
      break;
    default:
      return null;
  }

  const text = [
    hello,
    "",
    body,
    "",
    `Mirá el estado de tu pedido: ${url(`/pedido/${order.code}`)}`,
    "",
    "Córdoba Digital",
    STORE_EMAIL,
  ].join("\n");
  return { subject, text };
}

/**
 * Le avisa al cliente el nuevo estado de su pedido si el interruptor "Avisar al
 * cliente por email" está prendido y hay SMTP. Deja anotado en el historial del
 * pedido si se mandó o no. Nunca tira error: el cambio de estado ya está hecho.
 */
export async function notifyStatusChange(orderId: number, status: string, note = ""): Promise<void> {
  let subject = "";
  try {
    if (!mailConfigured() || !(await isAutomationOn("avisarCliente"))) return;
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    const mail = order ? orderStatusEmail(order, status, note) : null;
    if (!order || !mail) return;
    subject = mail.subject;
    await sendMail({ to: order.email, ...mail });
    await db
      .insert(orderEvents)
      .values({ orderId, fromStatus: status, toStatus: status, note: `Le avisamos al cliente por email: ${mail.subject}.` });
  } catch (error) {
    // Solo el código del error: el mensaje del SMTP puede traer el email del cliente.
    const { code, responseCode } = (error ?? {}) as { code?: string; responseCode?: number };
    console.error("[order-emails] no se pudo avisar al cliente:", orderId, status, code ?? "sin código", responseCode ?? "");
    if (!subject) return;
    await db
      .insert(orderEvents)
      .values({ orderId, fromStatus: status, toStatus: status, note: "No se pudo mandar el email al cliente." })
      .catch(() => undefined);
  }
}

/** "Vencido: sin pago en 24 hs." → "en las 24 horas que tenía". */
function expiredWithin(note: string): string {
  const hours = /en (\d+) hs/.exec(note)?.[1];
  return hours ? `en las ${hours} horas que tenía` : "a tiempo";
}
