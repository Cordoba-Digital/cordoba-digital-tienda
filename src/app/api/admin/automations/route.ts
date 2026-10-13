import { sessionFromCookieHeader } from "@/lib/admin-auth";
import { verifyAdminSessionValue } from "@/lib/admin-session";
import { actorFromRequest, logAdminAction } from "@/lib/admin-audit";
import { AUTOMATIONS, getAutomations, isAutomationId, setAutomation } from "@/lib/automations";

export const dynamic = "force-dynamic";

async function authorized(request: Request): Promise<boolean> {
  return verifyAdminSessionValue(sessionFromCookieHeader(request.headers.get("cookie")));
}

export async function GET(request: Request) {
  if (!(await authorized(request))) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  return Response.json({ ok: true, automations: await getAutomations() });
}

/** Prende o apaga un interruptor: `{ id, enabled }`. */
export async function PATCH(request: Request) {
  if (!(await authorized(request))) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { id?: unknown; enabled?: unknown };
  if (!isAutomationId(body.id) || typeof body.enabled !== "boolean") {
    return Response.json({ ok: false, error: "Interruptor o valor inválido." }, { status: 400 });
  }
  const actor = await actorFromRequest(request);
  const before = await setAutomation(body.id, body.enabled, actor);
  if (before !== body.enabled) {
    await logAdminAction(actor, {
      action: body.enabled ? "prender" : "apagar",
      entityType: "automatizacion",
      entityId: body.id,
      summary: `${body.enabled ? "Prendió" : "Apagó"} "${AUTOMATIONS[body.id].label}"`,
      changes: { activo: { from: before, to: body.enabled } },
    });
  }
  return Response.json({ ok: true, automations: await getAutomations() });
}
