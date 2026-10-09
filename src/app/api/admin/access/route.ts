import { adminActorLabel, sessionFromCookieHeader } from "@/lib/admin-auth";
import { readAdminSession } from "@/lib/admin-session";
import { addAdminAccess, isOwnerEmail, isValidEmail, normalizeEmail, removeAdminAccess } from "@/lib/admin-access";
import { logAdminAction } from "@/lib/admin-audit";

export const dynamic = "force-dynamic";

/** Solo dueños (`ADMIN_EMAILS`) o quien entró con la contraseña administran accesos. */
async function manager(request: Request): Promise<{ actor: string } | Response> {
  const session = await readAdminSession(sessionFromCookieHeader(request.headers.get("cookie")));
  if (!session) return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  if (session.email && !isOwnerEmail(session.email)) {
    return Response.json({ ok: false, error: "Solo los dueños pueden cambiar los accesos." }, { status: 403 });
  }
  return { actor: adminActorLabel(session) };
}

async function emailFrom(request: Request): Promise<string | null> {
  const body = (await request.json().catch(() => ({}))) as { email?: unknown };
  if (typeof body.email !== "string") return null;
  const email = normalizeEmail(body.email);
  return isValidEmail(email) ? email : null;
}

export async function POST(request: Request) {
  const who = await manager(request);
  if (who instanceof Response) return who;
  const email = await emailFrom(request);
  if (!email) return Response.json({ ok: false, error: "Escribí un email válido." }, { status: 400 });
  if (isOwnerEmail(email)) return Response.json({ ok: false, error: "Ese email ya es dueño." }, { status: 409 });
  if (!(await addAdminAccess(email, who.actor))) {
    return Response.json({ ok: false, error: "Ese email ya tiene acceso." }, { status: 409 });
  }
  await logAdminAction(who.actor, { action: "acceso_agregado", entityType: "acceso", entityId: email, summary: `Dio acceso al panel a ${email}` });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const who = await manager(request);
  if (who instanceof Response) return who;
  const email = await emailFrom(request);
  if (!email) return Response.json({ ok: false, error: "Email inválido." }, { status: 400 });
  if (isOwnerEmail(email)) {
    return Response.json({ ok: false, error: "Los dueños se quitan desde Vercel (ADMIN_EMAILS)." }, { status: 409 });
  }
  if (!(await removeAdminAccess(email))) {
    return Response.json({ ok: false, error: "Ese email no tenía acceso." }, { status: 404 });
  }
  await logAdminAction(who.actor, { action: "acceso_quitado", entityType: "acceso", entityId: email, summary: `Quitó el acceso al panel de ${email}` });
  return Response.json({ ok: true });
}
