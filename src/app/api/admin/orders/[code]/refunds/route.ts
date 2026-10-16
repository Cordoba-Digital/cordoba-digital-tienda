import { isOwnerEmail } from "@/lib/admin-access";
import { adminActorLabel, sessionFromCookieHeader } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";
import { refundOrder } from "@/lib/admin-refunds";
import { readAdminSession } from "@/lib/admin-session";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Devolver plata de un pedido (total o parcial). Mueve plata real, así que es
 * solo para dueños (`ADMIN_EMAILS`) o quien entró con la contraseña.
 * Body: `{ amount: number, reason: string }`.
 */
export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  const session = await readAdminSession(sessionFromCookieHeader(request.headers.get("cookie")));
  if (!session) return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  if (session.email && !isOwnerEmail(session.email)) {
    return Response.json({ ok: false, error: "Solo los dueños pueden devolver plata." }, { status: 403 });
  }
  const { code } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { amount?: unknown; reason?: unknown };
  if (typeof body.amount !== "number" || typeof body.reason !== "string") {
    return Response.json({ ok: false, error: "Faltan el monto o el motivo." }, { status: 400 });
  }

  const actor = adminActorLabel(session);
  const result = await refundOrder(decodeURIComponent(code), { amount: body.amount, reason: body.reason, actor });
  if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: result.status });

  await logAdminAction(actor, {
    action: "reembolso",
    entityType: "pedido",
    entityId: decodeURIComponent(code).trim().toUpperCase(),
    summary: `Devolvió ${money(result.refund.amount)} del pedido ${decodeURIComponent(code).trim().toUpperCase()}${result.cancelled ? " y lo canceló" : ""}`,
    changes: { reembolso: { from: null, to: `${money(result.refund.amount)} (${result.refund.reason})` } },
  });
  return Response.json({ ok: true, refund: result.refund, cancelled: result.cancelled, refunded: result.refunded });
}
