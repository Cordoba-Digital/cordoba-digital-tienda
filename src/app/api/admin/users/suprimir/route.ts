import { sessionFromCookieHeader } from "@/lib/admin-auth";
import { isOwnerEmail } from "@/lib/admin-access";
import { actorFromRequest, logAdminAction } from "@/lib/admin-audit";
import { readAdminSession } from "@/lib/admin-session";
import { erasePersonalData } from "@/lib/data-retention";

export const dynamic = "force-dynamic";

/**
 * Supresión de datos a pedido del cliente (ley 25.326). Body: `{ email }`.
 * No se deshace: solo dueños o quien entró con la contraseña. El registro de
 * actividad no guarda el email, porque justamente se está borrando.
 */
export async function POST(request: Request) {
  const session = await readAdminSession(sessionFromCookieHeader(request.headers.get("cookie")));
  if (!session) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  if (session.email && !isOwnerEmail(session.email)) {
    return Response.json({ ok: false, error: "Solo los dueños pueden borrar datos de clientes." }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as { email?: unknown };
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ ok: false, error: "Escribí el email del cliente." }, { status: 400 });
  }

  const result = await erasePersonalData(email);
  if (!result.ok) {
    return Response.json(
      {
        ok: false,
        error: `Tiene pedidos en curso (${result.openOrders.join(", ")}). Borrá los datos cuando estén entregados o cancelados.`,
      },
      { status: 409 },
    );
  }
  await logAdminAction(await actorFromRequest(request), {
    action: "eliminacion",
    entityType: "usuario",
    entityId: "-",
    summary: `Borró los datos personales de un cliente a su pedido (${result.orders} pedido${result.orders === 1 ? "" : "s"})`,
  });
  return Response.json(result);
}
