import { adminActorLabel, sessionFromCookieHeader } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";
import { registerReturn } from "@/lib/admin-returns";
import { readAdminSession } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

/**
 * Anotar productos devueltos que llegaron al local: vuelven al stock. No mueve
 * plata (eso es Reembolsos), así que lo puede hacer cualquiera del panel, igual
 * que cambiar el estado del pedido.
 * Body: `{ items: { orderItemId: number, quantity: number }[], reason: string }`.
 */
export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  const session = await readAdminSession(sessionFromCookieHeader(request.headers.get("cookie")));
  if (!session) return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  const { code } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { items?: unknown; reason?: unknown };
  const items = Array.isArray(body.items) ? body.items : null;
  if (
    !items ||
    items.length > 50 ||
    typeof body.reason !== "string" ||
    !items.every((i) => i && typeof i === "object" && typeof i.orderItemId === "number" && typeof i.quantity === "number")
  ) {
    return Response.json({ ok: false, error: "Faltan los productos o el motivo." }, { status: 400 });
  }

  const actor = adminActorLabel(session);
  const normalized = decodeURIComponent(code).trim().toUpperCase();
  const result = await registerReturn(normalized, { items, reason: body.reason, actor });
  if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: result.status });

  const list = result.return.items.map((i) => `${i.quantity} × ${i.name}`).join(", ");
  await logAdminAction(actor, {
    action: "devolucion",
    entityType: "pedido",
    entityId: normalized,
    summary: `Recibió la devolución de ${list} del pedido ${normalized}`,
    changes: { devolucion: { from: null, to: `${list} (${result.return.reason})` } },
  });
  return Response.json({ ok: true, return: result.return });
}
