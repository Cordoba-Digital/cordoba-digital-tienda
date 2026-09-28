import { eq } from "drizzle-orm";
import { Preference } from "mercadopago";

import { db } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { appBaseUrl, centsToUnits, isPublicAppUrl, mpClient, MP_CURRENCY } from "@/lib/mercadopago";

export const dynamic = "force-dynamic";

/**
 * Checkout Pro — crea la preferencia (Preferences API) para una orden existente.
 * Body: { code: "CD-XXXXXX" } con external_reference = código de orden.
 * Responde { ok, init_point } — siempre init_point, nunca sandbox_init_point.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { code?: string };
  const code = (body.code ?? "").trim().toUpperCase();
  if (!code) {
    return Response.json({ ok: false, error: "Falta el código de pedido." }, { status: 400 });
  }

  const client = mpClient();
  if (!client) {
    // El mensaje va al cliente final: nunca el nombre de una variable de
    // entorno. El detalle técnico queda en `detail` para los logs.
    console.warn("[mp] falta MP_ACCESS_TOKEN: el pago con Mercado Pago no está habilitado.");
    return Response.json(
      {
        ok: false,
        error:
          "El pago con Mercado Pago se habilita al conectar la cuenta del negocio. " +
          "Mientras tanto podés completar el pedido por transferencia o efectivo.",
        missingCredentials: true,
        detail: "MP_ACCESS_TOKEN no configurado",
      },
      { status: 503 },
    );
  }

  const [order] = await db.select().from(orders).where(eq(orders.code, code)).limit(1);
  if (!order) {
    return Response.json({ ok: false, error: "Pedido inexistente." }, { status: 404 });
  }
  if (order.paymentMethod !== "mercadopago") {
    return Response.json({ ok: false, error: "El pedido no usa Mercado Pago." }, { status: 409 });
  }

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  if (!items.length) {
    return Response.json({ ok: false, error: "El pedido no tiene items." }, { status: 409 });
  }

  const baseUrl = appBaseUrl(request);
  const publicUrl = isPublicAppUrl(baseUrl);

  try {
    const preference = new Preference(client);
    const result = await preference.create({
      body: {
        items: items.map((item) => ({
          id: item.productSlug,
          title: item.name.slice(0, 200),
          quantity: item.quantity,
          unit_price: centsToUnits(item.unitPrice),
          currency_id: MP_CURRENCY,
        })),
        payer: { email: order.email, name: order.customerName },
        back_urls: {
          success: `${baseUrl}/pedido/${order.code}?pago=exito`,
          failure: `${baseUrl}/pedido/${order.code}?pago=fallo`,
          pending: `${baseUrl}/pedido/${order.code}?pago=pendiente`,
        },
        // auto_return solo válido con URL pública HTTPS — MP rechaza localhost.
        ...(publicUrl ? { auto_return: "approved" as const } : {}),
        notification_url: publicUrl ? `${baseUrl}/api/webhooks/mercadopago` : undefined,
        external_reference: order.code,
        statement_descriptor: "CORDOBA DIGITAL",
      },
    });

    await db
      .update(orders)
      .set({ mercadopagoPreferenceId: result.id ?? null })
      .where(eq(orders.id, order.id));

    // Siempre init_point (sandbox_init_point fue eliminado por MP).
    return Response.json({ ok: true, init_point: result.init_point });
  } catch (error) {
    console.error("[mp] preference.create falló:", error);
    return Response.json({ ok: false, error: "No pudimos iniciar el pago. Probá de nuevo." }, { status: 502 });
  }
}
