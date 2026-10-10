import { getOrderByCode } from "@/lib/queries";
import { blockedMinutes, ipFromHeaders, ORDER_LOOKUP_LIMIT, recordMiss, tooManyAttempts } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email") ?? undefined;

  const ip = ipFromHeaders(request.headers);
  const blocked = await blockedMinutes(ORDER_LOOKUP_LIMIT, ip);
  if (blocked) return tooManyAttempts(blocked);

  const result = await getOrderByCode(code, email ?? undefined);
  if (!result) {
    await recordMiss(ORDER_LOOKUP_LIMIT, ip);
    return Response.json(
      { ok: false, error: "No encontramos un pedido con esos datos. Revisá el código y el email." },
      { status: 404 },
    );
  }

  // Solo lo que muestra "Seguir pedido". El código alcanza para consultar, así
  // que acá no viajan DNI, teléfono, email, dirección ni los ids de pago.
  const { order } = result;
  return Response.json({
    ok: true,
    order: {
      code: order.code,
      status: order.status,
      customerName: order.customerName,
      deliveryLabel: order.deliveryLabel,
      deliveryEta: order.deliveryEta,
      total: order.total,
      createdAt: order.createdAt,
    },
  });
}
